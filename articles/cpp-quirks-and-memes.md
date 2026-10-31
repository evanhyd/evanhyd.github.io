---
title: Modern C++ Quirks, Duck Typing, and Obfuscation Memes
date: 2026-10-28
tags: ["C++", "Memes", "Humor"]
summary: Arrays as pointers, variadic fold expressions acting like duck typing, node extraction, and funny variable names.
---

# Modern C++ Quirks & Memes

### 1. The commutative array indexing rule

Remember that `arr[i] = *(arr + i) = *(i + arr) = i[arr]`:

```cpp
int arr[] = {1, 2, 3};
for (int i = 0; i < 3; ++i) {
    i[arr] = 0; // Completely valid C & C++!
}
```

### 2. Duck typing in Modern C++ fold expressions

Who said C++ doesn't have duck typing?

```cpp
#include <iostream>
#include <string>

auto Add(const auto&... a) {
    return (... + a);
}

int main() {
    auto c0 = Add(-1, 2, -3);
    auto c1 = Add(1.2, 3.4, -3.1415926535);
    auto c2 = Add(std::string("unbox"), std::string("the"), std::string("cat"));
}
```

### 3. Extracting and re-keying nodes in `std::map`

Did you know you can change a map's key without re-allocating nodes using `extract`?

```cpp
#include <map>
#include <string>

std::map<int, std::string> mp = {{1, "foo"}, {2, "bar"}};

auto entry = mp.extract(1);
entry.key() = 3;
mp.insert(std::move(entry));
```

### 4. Top tier variable names for maximum obfuscation

```text
src, srce                   (source)
dst, dest                   (destination)
first, last                 (denote range [a, b])
i, j, k, x, y, z            (index for nested loops)
prev, curr, next            (parent/child nodes)
arr, vec, deq, que, lst     (containers)
mp                          (map / hashmap)
addr, ptr                   (pointers)
fn, fun, func               (functions)
```
