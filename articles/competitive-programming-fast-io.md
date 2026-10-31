---
title: Competitive Programming Hacks & Ultra-Fast I/O in C++
date: 2026-10-30
tags: ["C++", "Algorithms", "Performance"]
summary: Squeezing every millisecond in online judges with custom unlocked I/O parsers.
---

# Competitive Programming Hacks & Ultra-Fast I/O

When competing on platforms like Codeforces, AtCoder, or LeetCode, default `std::cin` and `std::cout` stream overhead can cause Time Limit Exceeded (TLE) verdicts on large test cases ($10^6$ integers).

### Baseline optimization

Always disable synchronization with C stdio and untie `cin`:

```cpp
const auto _ = std::cin.tie(nullptr)->sync_with_stdio(false);
```

### Next Level: Unlocked character reading

For extreme speed, bypass `iostream` completely and use `getchar_unlocked` (or `_getchar_nolock` on Windows):

```cpp
#if defined _WIN32 || defined _WIN64
inline char getchar_unlocked() { return static_cast<char>(_getchar_nolock()); }
#endif

template <std::signed_integral T>
T Read() {
    T x; bool neg = false; char c{};
    do { 
        c = getchar_unlocked(); 
        if (c == '-') neg = true; 
    } while (c < '0');
    
    for (x = c - '0'; '0' <= (c = getchar_unlocked()); x = (x << 3) + (x << 1) + c - '0') {}
    return neg ? -x : x;
}

template <std::unsigned_integral T>
T Read() {
    T x; char c{};
    do { c = getchar_unlocked(); } while (c < '0');
    for (x = c - '0'; '0' <= (c = getchar_unlocked()); x = (x << 3) + (x << 1) + c - '0');
    return x;
}
```

### Notice the bit shift multiplication trick:

`(x << 3) + (x << 1)` computes $8x + 2x = 10x$ without invoking integer multiplication!
