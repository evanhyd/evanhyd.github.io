---
title: How to Cheese CS Midterm Exam
date: 2022-06-09
tags: ["C++", "Algorithms", "Midterm"]
summary: When the professor forgot to specify "recursion only" on the exam question.
---


When the professor forgot to specify "recursion only":

![cheese_midterm](Image/CheeseMidterm.PNG?raw=true)

### Why this happens

Often exam specifications forget to restrict iterative solutions, or fail to ban external state. When you encounter a recursive problem on an algorithmic exam:

1. Always verify constraints: time limit, space limit, call stack depth.
2. If recursion is not explicitly enforced by the test runner or autograder, iterative alternatives can prevent stack overflows ($O(N)$ stack space vs $O(1)$).
3. If recursion is required, memoization or tail recursion is usually the intended pattern!
