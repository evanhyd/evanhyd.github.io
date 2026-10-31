---
title: Too Perfect Forwarding & Variadic Constructor Quirks
date: 2023-07-01
tags: ["C++", "Templates", "Modern C++"]
summary: Deep dive into C++ template constructor overload resolution and variadic perfect forwarding pitfalls.
---


Here is a classic trap with universal references in template constructors:

```cpp
template <typename T>
class FlagTree {
  T _data;

public:
  template <typename ...Args>
  FlagTree(Args&&... args) : 
    _data(std::forward<Args>(args)...) {
  }

  FlagTree(const FlagTree& rhs) : 
    _data(rhs._data) {
  }

  FlagTree(FlagTree& rhs) :
    FlagTree(const_cast<const FlagTree&>(rhs)) {
    // override perfect forwarding from the variadic constructor
    // otherwise it doesn't even compile!
  }
};
```

### Why does the copy constructor fail without this?

When you pass a non-const lvalue `FlagTree` to another `FlagTree`:
- The copy constructor takes `const FlagTree&`.
- The variadic constructor template `FlagTree(Args&&...)` deduces `Args = FlagTree&`, making an exact signature `FlagTree(FlagTree&)`.
- In C++ overload resolution, an exact non-const match beats a `const&` conversion! Thus, the compiler attempts to instantiate the variadic forwarding constructor for copy operations instead of invoking the copy constructor.

### Smuggling default arguments into variadic functions

Here's another handy pattern (credit to M.M):

```cpp
#include <source_location>
#include <iostream>

struct Bar {
    int a;
    const std::source_location srce;
    Bar(int b, const std::source_location s = std::source_location::current()) 
      : a(b), srce(s) {}
};

void Foo(Bar arg0, const auto&... args) {
  std::cout << "Invoked from: " << arg0.srce.function_name() 
            << " at line " << arg0.srce.line() << '\n';
}

int main() {
  // integer "1" implicitly converts to Bar, capturing source_location!
  Foo(1, 2, 3, 4, 5, 6);
}
```
