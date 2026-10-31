---
title: "Profiling Data Structure in GO"
date: 2024-01-13
tags: ["Go", "Software Engineering", "Algorithms"]
summary: "GO provides only a few data structures such as slice (dynamic array), map (hash table), and some other [containers](https://pkg.go.dev/container). Recently I have been porting my custom data struct..."
---

GO provides only a few data structures such as slice (dynamic array), map (hash table), and some other [containers](https://pkg.go.dev/container). Recently I have been porting my custom data structure library from [C++](https://github.com/evanhyd/DataStructure) to [GO](https://github.com/evanhyd/sgl), which includes a generic Binary Heap and a Binomial Heap.

```go
type BinaryHeap[T any] struct {
 slice []T
 Cmp   func(T, T) int
}

func (b *BinaryHeap[T]) Push(e T) {
 b.slice = append(b.slice, e)
 b.fixUp(len(b.slice) - 1)
}

func (b *BinaryHeap[T]) Pop() {
 last := len(b.slice) - 1
 b.slice[0] = b.slice[last]
 var zero T
 b.slice[last] = zero
 b.slice = b.slice[:last]
 b.fixDown(0)
}

func (b *BinaryHeap[T]) Top() T {
 return b.slice[0]
}

func (b *BinaryHeap[T]) fixUp(child int) {
 for i := child; i > 0; {
  p := b.parent(i)
  if b.Cmp(b.slice[i], b.slice[p]) > 0 {
   b.slice[i], b.slice[p] = b.slice[p], b.slice[i]
   i = p
  } else {
   break
  }
 }
}

func (b *BinaryHeap[T]) fixDown(root int) {
 for i, j := root, len(b.slice)/2; i < j; {
  child := b.left(i)
  if r := child + 1; r < len(b.slice) {
   if b.Cmp(b.slice[r], b.slice[child]) > 0 {
    child = r
   }
  }

  if b.Cmp(b.slice[child], b.slice[i]) > 0 {
   b.slice[i], b.slice[child] = b.slice[child], b.slice[i]
   i = child
  } else {
   break
  }
 }
}

func (b *BinaryHeap[T]) parent(i int) int {
 return (i - 1) / 2
}

func (b *BinaryHeap[T]) left(i int) int {
 return i*2 + 1
}

//omitted utility functions
```

```go
type flagTree[T any] struct {
 key   T
 left  *flagTree[T]
 right *flagTree[T]
}

type BinomialHeap[T any] struct {
 trees []*flagTree[T]
 Cmp   func(T, T) int
 len   int
}

func (b *BinomialHeap[T]) Push(e T) {
 b.len++
 b.reserve()
 b.mergeTree(&flagTree[T]{e, nil, nil}, 0)
}

func (b *BinomialHeap[T]) Pop() {
 b.len--
 height := b.max()
 tree := b.trees[height].left
 b.trees[height] = nil

 //split the flag tree into smaller flag trees
 for height--; height >= 0; height-- {
  subTree := tree.right
  tree.right = nil
  b.mergeTree(tree, height)
  tree = subTree
 }
}

func (b *BinomialHeap[T]) Top() T {
 return b.trees[b.max()].key
}

func (b *BinomialHeap[T]) max() int {
 m := -1
 for i, tree := range b.trees {
  if tree != nil && (m == -1 || b.Cmp(b.trees[i].key, b.trees[m].key) > 0) {
   m = i
  }
 }
 return m
}

func (b *BinomialHeap[T]) reserve() {
 maxHeight := bits.Len(uint(b.len))
 if len(b.trees) < maxHeight {
  trees := make([]*flagTree[T], maxHeight)
  copy(trees, b.trees)
  b.trees = trees
 }
}

func (b *BinomialHeap[T]) mergeTree(tree *flagTree[T], height int) {
 for ; height < len(b.trees); height++ {
  t := b.trees[height]
  if t == nil {
   b.trees[height] = tree
   break
  }
  b.trees[height] = nil

  if b.Cmp(t.key, tree.key) > 0 {
   tree, t = t, tree
  }
  tree.left, t.right = t, tree.left
 }
}

//omitted utility functions
```

From my prior experience, data structures that involve read/write across scattered memory, specifically linked-list type nodes that are allocated on the heap, often run slower and consume more memory compared to data structure that uses a block of contiguous buffer.

The former can be caused by cache missing or perhaps an incompetent GC, while the latter might be due to the extra bytes from the pointer itself in addition to the object it points to.

```go
//2 words in total
var ptr *int // 1 word
ptr = new(int) // 1 word
```

![https://en.wikipedia.org/wiki/Heap_(data_structure)](https://cdn-images-1.medium.com/max/695/1*T3jf6_XJUs8XqrR7JHktBA.png)
*https://en.wikipedia.org/wiki/Heap_(data_structure)*

Despite both Binary Heap and Binomial Heap having the same time complexity for the Push/Insert and Pop/DeleteMax operators, one would expect that Binomial Heap, which uses a tree structure under the hood would have a much higher constant, and therefore runs slower than the Binary Heap that uses a contiguous array.

To prove my point, I wrote 4 benchmarks: Push_Small(), Push_Big(), Pop_Small(), and Pop_Big() for both the Binary Heap and Binomial Heap.

```go
func BenchmarkBinaryHeap_Push_Small(b *testing.B) {
 heap := BinaryHeap[int64]{Cmp: func(l, r int64) int { return int(l - r) }}
 b.ResetTimer()
 for i := 0; i < b.N; i++ {
  heap.Push(int64(i % 1024))
 }
}

func BenchmarkBinaryHeap_Push_Big(b *testing.B) {
 type Large struct {
  a int64
  b [20]int64
 }
 heap := BinaryHeap[Large]{Cmp: func(l, r Large) int { return int(l.a - r.a) }}
 b.ResetTimer()

 for i := 0; i < b.N; i++ {
  heap.Push(Large{a: int64(i % 1024)})
 }
}

func BenchmarkBinaryHeap_Pop_Small(b *testing.B) {
 heap := BinaryHeap[int64]{Cmp: func(l, r int64) int { return int(l - r) }}
 for i := 0; i < b.N; i++ {
  heap.Push(int64(i % 1024))
 }
 b.ResetTimer()
 for i := 0; i < b.N; i++ {
  heap.Pop()
 }
}

func BenchmarkBinaryHeap_Pop_Big(b *testing.B) {
 type Large struct {
  a int64
  b [20]int64
 }
 heap := BinaryHeap[Large]{Cmp: func(l, r Large) int { return int(l.a - r.a) }}
 for i := 0; i < b.N; i++ {
  heap.Push(Large{a: int64(i % 1024)})
 }
 b.ResetTimer()

 for i := 0; i < b.N; i++ {
  heap.Pop()
 }
}
```

Anddddddddddddddddddddd here’s the benchmark results:

Opps, it didn’t match my expectation quite well…

```go
>> go test -bench="Pop|Push"
// Binary Heap
// BenchmarkBinaryHeap_Push_Small-16   63683304       16.21 ns/op       46 B/op        0 allocs/op
// BenchmarkBinaryHeap_Push_Big-16      4488074       273.3 ns/op      996 B/op        0 allocs/op
// BenchmarkBinaryHeap_Pop_Small-16     7645639       262.3 ns/op        0 B/op        0 allocs/op
// BenchmarkBinaryHeap_Pop_Big-16       1000000        1524 ns/op        0 B/op        0 allocs/op

// Binomial Heap
// BenchmarkBinomialHeap_Push_Small-16   19541204        55.06 ns/op       24 B/op        1 allocs/op
// BenchmarkBinomialHeap_Push_Big-16      7366681        147.7 ns/op      176 B/op        1 allocs/op
// BenchmarkBinomialHeap_Pop_Small-16     9049855        282.7 ns/op        0 B/op        0 allocs/op
// BenchmarkBinomialHeap_Pop_Big-16       3472489        548.2 ns/op        0 B/op        0 allocs/op
```

Although the Binary Heap Push() and Pop() ran faster with int64 = 8 bytes, Binomial Heap quickly outperformed Binary Heap when the object size is &gt; 160 bytes.

One may quickly realize this might have something to do with copying large sizes of data inside the fixUp() and fixDown() functions. This intuition might be correct, but we need more details to analyze its effect if there are any.

GO comes with quite a lot of tools that help us to test, benchmark, and profile codes. For instance, the “[**testing**](https://pkg.go.dev/testing)” package allows us to generate CPU/Memory profiles using “[**pprof**](https://go.dev/blog/pprof)”.

We first generate the profiling info using “go test”:

```go
>> go test -cpuprofile cpu.out -bench "Pop" 
BenchmarkBinaryHeap_Pop_Small-16         7766276             272.3 ns/op
BenchmarkBinaryHeap_Pop_Big-16           1000000              1597 ns/op
```

![](https://cdn-images-1.medium.com/max/312/1*8lsc7WDIEELmXlrWSEhKpg.png)

We can then check out the result using pprof:

```go
>> go tool pprof cpu.out
(pprof) >> top 5

      flat  flat%   sum%        cum   cum%
     530ms 38.13% 38.13%      530ms 38.13%  runtime.duffcopy
     520ms 37.41% 75.54%      980ms 70.50%  github.com/evanhyd/sgl/binary_heap.(*BinaryHeap[go.shape.struct { github.com/evanhyd/sgl/binary_heap.a int64; github.com/evanhyd/sgl/binary_heap.b [20]int64 }]).fixDown
     130ms  9.35% 84.89%      130ms  9.35%  runtime.procyield
     110ms  7.91% 92.81%      110ms  7.91%  runtime.memmove
      30ms  2.16% 94.96%       30ms  2.16%  runtime.memclrNoHeapPointers
```

We see **fixDown()** occupying most of the CPU, followed by **runtime.duffcopy()**. Let’s first examine the fixDown().

```go
(pprof) >> list fixDown
     520ms      980ms (flat, cum) 70.50% of Total
         .          .    110:func (b *BinaryHeap[T]) fixDown(root int) {
         .          .    111:   for i, end := root, len(b.slice)/2; i < end; {
         .          .    112:           child := b.left(i)
         .          .    113:
      20ms       20ms    114:           if r := child + 1; r < len(b.slice) {
     460ms      660ms    115:                   if b.Cmp(b.slice[r], b.slice[child]) > 0 {
         .          .    116:                           child = r
         .          .    117:                   }
         .          .    118:           }
         .          .    119:
      20ms      180ms    120:           if b.Cmp(b.slice[child], b.slice[i]) > 0 {
      20ms      120ms    121:                   b.slice[i], b.slice[child] = b.slice[child], b.slice[i]
         .          .    122:                   i = child
         .          .    123:           } else {
         .          .    124:                   break
         .          .    125:           }
         .          .    126:   }
```

Line 115 took up most of the CPU time, with a flat CPU time of 460ms. A quick look at the b.Cmp signature, we notice that we are copying the “Large” object into the function each time we compare. One way to fix this is by changing the way we store large-size objects: making the Binary Heap store a pointer to an array instead of a copy of the array. This is not the best solution, as it may incur heap allocation and increase memory usage. However, it is good enough for the demonstration purpose.

```go
func BenchmarkBinaryHeap_Push_Big(b *testing.B) {
 type Large struct {
  a int64
  b [20]int64
 }
 heap := BinaryHeap[*Large]{Cmp: func(l, r *Large) int { return int(l.a - r.a) }}
 b.ResetTimer()

 for i := 0; i < b.N; i++ {
  heap.Push(&Large{a: int64(i % 1024)})
 }
}

func BenchmarkBinaryHeap_Pop_Big(b *testing.B) {
 type Large [20]int64
 heap := BinaryHeap[*Large]{Cmp: func(l, r *Large) int { return int(l[0] - r[0]) }}
 for i := 0; i < b.N; i++ {
  heap.Push(&Large{int64(i % 1024)})
 }
 b.ResetTimer()

 for i := 0; i < b.N; i++ {
  heap.Pop()
 }
}
```

```go
BenchmarkBinaryHeap_Push_Big-16      8145301       137.0 ns/op      208 B/op        1 allocs/op
BenchmarkBinaryHeap_Pop_Big-16      1638912        791.1 ns/op        0 B/op        0 allocs/op

(pprof) >> top 5
      flat  flat%   sum%        cum   cum%
    1100ms 67.90% 67.90%     1100ms 67.90%  github.com/evanhyd/sgl/binary_heap.BenchmarkBinaryHeap_Pop_Big.func1     
     280ms 17.28% 85.19%     1330ms 82.10%  github.com/evanhyd/sgl/binary_heap.(*BinaryHeap[go.shape.*uint8]).fixDown
      70ms  4.32% 89.51%       70ms  4.32%  runtime.stdcall4
      30ms  1.85% 91.36%       30ms  1.85%  runtime.stdcall1
      20ms  1.23% 92.59%       40ms  2.47%  runtime.findObject

(pprof) >> list fixDown
     250ms      1.28s (flat, cum) 78.05% of Total
         .          .    110:func (b *BinaryHeap[T]) fixDown(root int) {
         .          .    111:   for i, end := root, len(b.slice)/2; i < end; {
      10ms       10ms    112:           child := b.left(i)
         .          .    113:
         .          .    114:           if r := child + 1; r < len(b.slice) {
      80ms      990ms    115:                   if b.Cmp(b.slice[r], b.slice[child]) > 0 {
      40ms       40ms    116:                           child = r
         .          .    117:                   }
         .          .    118:           }
         .          .    119:
     110ms      230ms    120:           if b.Cmp(b.slice[child], b.slice[i]) > 0 {
      10ms       10ms    121:                   b.slice[i], b.slice[child] = b.slice[child], b.slice[i]
         .          .    122:                   i = child
         .          .    123:           } else {
         .          .    124:                   break
         .          .    125:           }
         .          .    126:   }
```

**Amazing!** The running time is immediately cut in half! A 100% performance improvement compared to the previous version.

Line 115 flat time has reduced from 460ms to 80ms, and runtime.duffcopy()** **has disappeared from the top list. There are other issues such as unable to [inline the comparator function](https://stackoverflow.com/questions/4708105/performance-of-qsort-vs-stdsort). Further experiments show an inline comparator can reduce the cost from 800ns/op down to 600ns/op, a 25% improvement.

---
*Originally published on [Medium](https://unboxthecat.medium.com/profiling-data-structure-in-go-5c54a2be93ce?source=rss-1992b6042956------2) on January 13, 2024.*
