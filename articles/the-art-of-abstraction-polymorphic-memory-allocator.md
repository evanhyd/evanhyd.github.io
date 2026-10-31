---
title: "The Art of Abstraction — Polymorphic Memory Allocator"
date: 2025-09-27
tags: ["Software Development", "C++"]
summary: "I’ve been developing my own data structure library for years, recently renamed to the [Flow Library](https://github.com/evanhyd/DataStructure). While I’ve made steady improvements, most of my conta..."
---

I’ve been developing my own data structure library for years, recently renamed to the [Flow Library](https://github.com/evanhyd/DataStructure). While I’ve made steady improvements, most of my containers are missing key features, such as support for custom memory allocators.

![My old custom vector implementation](https://cdn-images-1.medium.com/max/716/1*jRqtf4Ossy5mhnaGvbPipQ.png)
*My old custom vector implementation*

This is a snippet from my custom vector implementation. In retrospect, there are numerous problems with my interface and implementation design.

From the interface perspective, my vector is missing an Allocator template type. This forces the vector to request memory from operator new and operator new only. The issues arise when the users frequently request memory allocation due to “**unforeseen circumstances”**. This may cause lag spike or extreme memory fragmentation (in certain vehicle ECUs) as malloc can be very expensive depending on the usages and implementation. In extreme cases, a 1ms lag spike can miss the missile by 9.8m in a defense system, or lead to a market order being stolen while travelling from [New York to Chicago](https://en.wikipedia.org/wiki/Spread_Networks).

One “simple solution” is mimicking the std::vector interface by providing an additional Allocator type parameter.

```cpp
std::vector<int> vec; // uses default heap
std::vector<int, ArenaAllocator<int>> vec; // uses arena allocator
std::vector<int, BuddyAllocator<int>> vec; // uses buddy system allocator
```

For starters, certain existing code can break because the function parameter types no longer match up.

```cpp
// Function expects a vector<int, std::allocator<int>>.
// But the users pass in vector<int, ArenaAllocator<int>>.
// A better design should take a pair of iterators perhaps?
void printVector(const std::vector<int>& v) {
    for (int x : v) {
      std::cout << x << " ";
    }
}
```

The nested containers declaration becomes extremely complicated and unreadable.

```cpp
std::vector<std::vector<int, ArenaAllocator<int>>, ArenaAllocator<std::vector<int, ArenaAllocator<int>>>> nestedVec;
//or equivalently
using InnerVec = std::vector<int, ArenaAllocator<int>>;
using OuterVec = std::vector<InnerVec, ArenaAllocator<InnerVec>>;
OuterVec nestedVec;
```

From the implementation perspective, my vector’s memory expansion algorithm is badly designed. It always doubles the capacity just like GCC’s vector as of 2025.

![Memory usage visualization. The 4th expansion takes 8 units of memory.](https://cdn-images-1.medium.com/max/464/1*Du6N3oiHAS7Ml435SEb0Dg.png)
*Memory usage visualization. The 4th expansion takes 8 units of memory.*

This means that the next requested memory block is always greater in size than the sum of all previously released blocks. Thus, the container will never be able to reuse those blocks! Other implementations like MSVC or Folly use a growth rate of 1.5 (close to the golden ratio) to resolve this issue.

With all these concerns in mind, I want my new container designs to avoid these pitfalls while providing a flexible interface that allows users to tune the memory allocation patterns.

### Allocator Models

The first step is choosing a memory allocator model. Prior to C++11, memory allocators were required to be stateless, though this constraint was later relaxed as it was too limiting. For the sake of simplicity and flexibility, I ended up with the Polymorphic Allocator **similar **to Bloomberg’s [BDE/BSL](https://github.com/bloomberg/bde)’s implementation.

![Polymorphic Allocator](https://cdn-images-1.medium.com/max/688/1*Qx6LpD7ydMsgzqGTaAliNA.png)
*Polymorphic Allocator*

This allocator model contains two major interfaces: A Polymorphic Allocator, and a Polymorphic Memory Resource.

The Polymorphic Allocator is a wrapper around a non-owning memory resource. Its key function, allocate(), computes metadata such as size and alignment, and then forwards this information to the underlying memory resource, which performs the actual allocation. **This is just your average OOP polymorphism.**

```cpp
template <typename T = std::byte>
class PolymorphicAllocator {
public:
  using value_type = T;

  explicit PolymorphicAllocator(MemoryResource& resource) noexcept
    : resource_(&resource) {
  }

  template <typename U>
  PolymorphicAllocator(const PolymorphicAllocator<U>& allocator) noexcept
    : resource_(allocator.resource_) {
  }

  T* allocate(std::size_t count) {
    return static_cast<T*>(resource_->allocate(sizeof(T) * count, alignof(T)));
  }

  void deallocate(T* address, std::size_t count) noexcept {
    resource_->deallocate(address, sizeof(T) * count, alignof(T));
  }

  template <typename U, typename... Args>
  void construct(U* address, Args&&... args) {
    ::new (address) U(std::forward<Args>(args)...);
  }

  template <typename U>
  void destroy(U* address) noexcept {
    address->~U();
  }

private:
  MemoryResource* resource_; ///< Non-owning pointer to a memory resource.
};
```

The MemoryResource class defines the allocate/deallocate interface that the dervied classes must implement.

```cpp
class MemoryResource {
 public:
   virtual ~MemoryResource() = default;

   void* allocate(std::size_t bytes, std::size_t alignment = alignof(std::max_align_t)) {
     return allocateImp(bytes, alignment);
   }

   void deallocate(void* address, std::size_t bytes, std::size_t alignment = alignof(std::max_align_t)) {
     deallocateImp(address, bytes, alignment);
   }

 protected:
   virtual void* allocateImp(std::size_t bytes, std::size_t alignment) = 0;
   virtual void deallocateImp(void* address, std::size_t bytes, std::size_t alignment) = 0;
 };
```

For instance, we can build a simple default allocator and an arena allocator as follows:

```cpp
class DefaultMemoryResource : public MemoryResource {
public:
  static DefaultMemoryResource& getResource() {
    static DefaultMemoryResource instance{};
    return instance;
  }

private:
  virtual void* allocateImp(std::size_t bytes, std::size_t alignment) {
    return ::operator new(bytes, alignment);
  }

  virtual void deallocateImp(void* address, std::size_t bytes, std::size_t alignment) {
    ::operator delete(address, alignment);
  }
};
 

class ArenaMemoryResource : public MemoryResource {
public:
  explicit ArenaMemoryResource(void* buffer, std::size_t capacity) noexcept
    : buffer_(buffer), capacity_(capacity) {
  }

protected:
  void* buffer_;
  std::size_t capacity_;

  virtual void* allocateImp(std::size_t bytes, std::size_t alignment) override {
    void* aligned = std::align(alignment, bytes, buffer_, capacity_);
    if (!aligned || capacity_ < bytes) {
      throw std::bad_alloc();
    }

    buffer_ = static_cast<std::byte*>(aligned) + bytes;
    capacity_ -= bytes;
    return aligned;
  }

  virtual void deallocateImp(void* address, std::size_t bytes, std::size_t alignment) override {
  }
};
```

Now, instead of replicating what STL did with vector<T, AllocatorType<T>>, where AllocatorType<T> can be ArenaAllocator<T>, PoolAllocator<T>, or other type of allocator, **we always use PolymorphicAllocator<T> and instantiate the PolymorphicAllocator<T> with different instances of MemoryResources depends on the strategy we want.**

```cpp
// Three different allocators but same vector type.
ArenaMemoryResource r1{};
BuddyMemoryResource r2{};
DefaultMemoryResource r3{};

PolymorphicAllocator<int> allocator{r1};
vector<int, PolymorphicAllocator<int>> alloc{ allocator };

PolymorphicAllocator<int> allocator{r2};
vector<int, PolymorphicAllocator<int>> alloc{ allocator };

PolymorphicAllocator<int> allocator{r3};
vector<int, PolymorphicAllocator<int>> alloc{ allocator };|
```

This way, the users no longer need to change the API signature when swapping the allocator implementation. To make it easier to use, we can default the allocator type to the PolymorphicAllocator<T>, and this will solve the nested declaration issues that we mentioned earlier.

```cpp
template <typename T, typename Allocator = PolymorphicAllocator<T>>
class Vector;
```

This memory allocator model is not perfect as it relies on virtual functions, which may introduce overhead due to extra indirections and un-inlinable code. While techniques such as Profile Guided Optimization can help mitigate these costs, that’s beyond the scope of this discussion. So, is the polymorphic allocator model worth it? It’s hard to draw conclusions without profiling, but in most cases, the cost of malloc calls outweighs the overhead of virtual function calls, and on top of that, the cost of code maintenance outweighs almost everything.

Finally, C++ 17 added pmr to its memory management library. You can try out the polymorphic allocator for free!

Credit:
Emre B. Reviewing articles and feedback.
Scott W. Reviewing articles and feedback.

---
*Originally published on [Medium](https://unboxthecat.medium.com/the-art-of-abstraction-polymorphic-memory-allocator-5f8fcd596c9a?source=rss-1992b6042956------2) on September 27, 2025.*
