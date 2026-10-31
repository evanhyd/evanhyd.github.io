---
title: "The Art of Abstraction — Spoof STL with custom iterator"
date: 2024-08-04
tags: ["C++", "Software Engineering", "Algorithms"]
summary: "Spoofing C++ STL binary search algorithms across large continuous search spaces with custom iterator abstractions."
---


## Context

You are given a function `p(x) -> bool`.

```cpp
// Return true if x exceeds an unknown threshold.
// Computation is very expensive.
bool p(int x);
```

p(x) may denote the maximum acceptable current in a circuit, the ID of the git commit that introduces bugs ([*git bisect*](https://git-scm.com/docs/git-bisect)), or even the minimum amount of money required to bribe a politician. One may attempt to use binary search to find the threshold **i**, such that **p(x) = true, &forall;x &ge; i** and false otherwise. There are plenty of binary search tutorials online, and my favorite one is the generalized binary search that finds lower bound and upper bound at once: [*Binary search and other “halving” methods.*](https://web.archive.org/web/20250117082908/https://nor-blog.codeberg.page/posts/2021-11-07-binary-search/)

## Binary Search in STL

C++’s STL provides binary search functions that accept a pair of iterators denotes the searching range, followed by the wanted value or a predicate:

[std::binary_search](https://en.cppreference.com/w/cpp/algorithm/binary_search)

[std::partition_point](https://en.cppreference.com/w/cpp/algorithm/partition_point)

[std::lower_bound](https://en.cppreference.com/w/cpp/algorithm/lower_bound)

[std::upper_bound](https://en.cppreference.com/w/cpp/algorithm/upper_bound)

[std::equal_range](https://en.cppreference.com/w/cpp/algorithm/equal_range)

```cpp
// A mysterious api call that does not explicitly tell us the threshold.
// It costs 1.00000000 bitcoin per call.
bool p(int x) {
  return x < THRESHOLD;
}

int findThreshold(vector<int> possibleValues) {
  // Binary search the threshold.
  auto it = partition_point(possibleValues.begin(), possibleValues.end(), p);
  return *it; // Or not exist if it == possibleValues.end()
}
```

But what if the searching range spans from [-2³⁰, 2³⁰]? It is infeasible to create an array filled with these values just to use the STL binary search algorithm, since the memory will blow up if the range is too big.

## Abstraction come to rescue!

Instead, we can create our own iterators that simply holds an integer internally. When the users advance the iterator by N positions, we simply add N to the internal values. This allows us to spoof the binary search algorithm, when in reality, the pair of iterators are just two integers instead of pointers that denotes the range of a container.

```cpp
template <typename T>
class IntegerIterator {
  T _value;

public:
  using value_type = T;
  using difference_type = std::ptrdiff_t;
  using reference = T; //intentional
  using pointer = T*;
  using iterator_category = std::random_access_iterator_tag;

  IntegerIterator(const T& value) : _value(value) {
    using Trait = typename std::iterator_traits<IntegerIterator>::iterator_category;
    static_assert(std::is_convertible_v<Trait, std::bidirectional_iterator_tag>, "not bidirectional iterator");
    static_assert(std::is_convertible_v<Trait, std::random_access_iterator_tag>, "not random access iterator");
    static_assert(std::is_integral_v<T>, "IntegerIterator only supports integer type");
  }

  reference operator*() const { return _value; }
  pointer operator->() const { return &_value; }

  IntegerIterator& operator++() {
    ++_value;
    return *this;
  }

  IntegerIterator operator++(int) {
    IntegerIterator it = *this;
    ++*this;
    return it;
  }

  IntegerIterator& operator--() {
    --_value;
    return *this;
  }

  IntegerIterator operator--(int) {
    IntegerIterator it = *this;
    --*this;
    return it;
  }

  IntegerIterator& operator+=(difference_type n) {
    _value += n;
    return *this;
  }

  difference_type operator-(IntegerIterator& rhs) const {
    return _value - rhs._value;
  }

  reference operator[](difference_type n) const {
    return _value + n;
  }

  friend bool operator<(const IntegerIterator& lhs, const IntegerIterator& rhs) {
    return lhs._value < rhs._value;
  }

  friend bool operator==(const IntegerIterator& lhs, const IntegerIterator& rhs) {
    return lhs._value == rhs._value;
  }

  friend void swap(IntegerIterator& lhs, IntegerIterator& rhs) {
    using std::swap;
    swap(lhs._value, rhs._value);
  }
};

template <typename T>
IntegerIterator<T>& operator-=(IntegerIterator<T>& lhs, typename IntegerIterator<T>::difference_type n) {
  lhs += -n;
  return lhs;
}

template <typename T>
IntegerIterator<T> operator+(IntegerIterator<T> lhs, typename IntegerIterator<T>::difference_type n) {
  lhs += n;
  return lhs;
}

template <typename T>
IntegerIterator<T> operator+(typename IntegerIterator<T>::difference_type n, IntegerIterator<T> rhs) {
  return rhs + n;
}

template <typename T>
IntegerIterator<T> operator-(IntegerIterator<T> lhs, typename IntegerIterator<T>::difference_type n) {
  lhs -= n;
  return lhs;
}

template <typename T>
bool operator>(const IntegerIterator<T>& lhs, const IntegerIterator<T>& rhs) {
  return rhs < lhs;
}

template <typename T>
bool operator>=(const IntegerIterator<T>& lhs, const IntegerIterator<T>& rhs) {
  return !(lhs < rhs);
}

template <typename T>
bool operator<=(const IntegerIterator<T>& lhs, const IntegerIterator<T>& rhs) {
  return !(lhs > rhs);
}

template <typename T>
bool operator!=(const IntegerIterator<T>& lhs, const IntegerIterator<T>& rhs) {
  return !(lhs == rhs);
}
```

Most of the functions are just boilerplate to satisfy the random access iterator traits. This is **required** in order for STL algorithms to advance the iterators in O(1) times.

Compile the code, and voila! It works like a charm:

```cpp
constexpr i64 THRESHOLD = 177013;
bool p(i64 x) {
  return x < THRESHOLD;
}

int main() {
  i64 X = -123456789;
  i64 Y = 123456789;
  auto it = partition_point(IntegerIterator(X), IntegerIterator(Y), p);
  cout << *it << '\n';
}
```

Note:
C++ 20’s `std::views::iota()` and `boost::CountingIterator` work in a similar way.

```cpp
auto spaces = std::views::iota(X, Y);
auto it = std::partition_point(spaces.begin(), spaces.end(), p);
```

Float types don’t work well due to the way STL implement its binary search operations.

---
*Originally published on [Medium](https://unboxthecat.medium.com/the-art-of-abstraction-stl-binary-search-in-large-continuous-space-3eca69dc72bd?source=rss-1992b6042956------2) on August 04, 2024.*
