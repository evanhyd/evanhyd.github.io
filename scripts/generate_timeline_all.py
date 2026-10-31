import os

v4_markdown = '''## KittyEngine V4

### 2021-09-10
- Neural network weights update

### 2021-09-09
- Neural network weights update

### 2021-09-08
- Custom neural network evaluation (`kitty_brain.nn`)
- Neural network boardstate restoration fix
- Neural network update function bugfix

### 2021-08-30
- Piece mobility evaluation bonuses & weight tuning
- Fast hash table bool array for repeated positions (27M nodes/s)
- UCI `movetime` support
- Rook semi-open & open file evaluation bonuses
- Iterative deepening aspiration window adjustment

### 2021-08-29
- Stacked & isolated pawn evaluation penalties
- Passed pawn evaluation bonuses
- Quiescence search Transposition Table storage removal

### 2021-08-28
- Late Move Reduction (LMR) optimization
- Transposition Table LMR threshold fix

### 2021-08-27
- Transposition Table (TT) implementation
- C++ std::random generator integration
- UCI blitz game time control timer
- Threefold repetition detection

### 2021-08-26
- Late Move Reduction (LMR)
- Null move pruning rate tuning

### 2021-08-25
- Hardware bit manipulation optimization (`__popcnt`, `CountBit`, `GetLeastSigBit`)
- Evaluation function & null move performance tuning

### 2021-08-24
- Principal Variation Search (PVS)

### 2021-08-23
- Move priority scoring & `VIOLENT_MOVE_FLAG`
- Principal Variation (PV) table
- Killer heuristic quiet move recording fix

### 2021-08-22
- Move ordering with capture & promotion bonuses
- Move priority & ordering function
- Bitboard `GetLeastSigBit` 75% search speedup
- Negamax search & Quiescence search

### 2021-08-21
- Piece-square evaluation tables & evaluation function
- Bitboard bit flip operation optimization

### 2021-08-20
- UCI protocol engine interface (`position`, `go`, command parser)
- UCI position parsing function

### 2021-08-18
- Move parser
- Move generator & make-move bugfixes (passed Perft suite at 30M nodes/s)

### 2021-08-17
- `MakeMove` implementation
- Perft test suite

### 2021-08-16
- `BoardState` class for board state snapshots
- Custom fast stack for move history
- Boardstate copy-based takeback / unmake move
- Move generator skeleton & `Move` / `FastStack` classes

### 2021-08-15
- Pawn move generator optimization

### 2021-08-14
- Bitboard move generator (`GenerateMoves`)
- Attack detection function (`IsSquareAttacked`)
- Initial magic bitboard chess engine architecture
'''

v3_markdown = '''## KittyEngine V3

### 2021-08-14
- 12×10 mailbox board representation
- Move table & bit-hack mask table initialization
- Piece capture priority tables
- Zobrist hashing for board position signatures
- Alpha-Beta Negamax search framework
'''

v2_markdown = '''## KittyEngine V2

### 2021-08
- Board-centric data structure prototyping (transitioning away from OOP piece classes)
- Alpha-Beta minimax search experiments
- Move representation & evaluation prototype
'''

v1_markdown = '''## KittyEngine V1

### 2021-08-14
- Object-Oriented (OOP) piece class hierarchy (`Piece`, `Pawn`, `Knight`, `Bishop`, `Rook`, `Queen`, `King`)
- Coordinate system & 8×8 board representation
- Per-piece legal move generation & piece interaction rules
- Console game loop & board rendering
'''

old_path = r'C:\Users\evanh\Desktop\evanhyd.github.io\articles\kittyenginev5-development-timeline.md'
with open(old_path, 'r', encoding='utf-8') as f:
    old_content = f.read()

v5_start = old_content.find('### 2026-10-31')
v5_body = old_content[v5_start:].strip()

header = '''---
title: "KittyEngine Development Timeline"
date: 2026-10-31
tags: ["C++", "Software Engineering", "Video Games"]
summary: "Chronological feature development timeline across all generations of the KittyEngine chess engine (V1 through V5)."
---

A comprehensive chronological log of features, search algorithms, move generation optimizations, board representations, and evaluation architectures implemented across every generation of **KittyEngine**, from the early C++ OOP prototype to modern NNUE-driven bitboard engines.

## KittyEngine V5

'''

full_doc = header + v5_body + '\n\n' + v4_markdown + '\n' + v3_markdown + '\n' + v2_markdown + '\n' + v1_markdown + '\n'

new_path = r'C:\Users\evanh\Desktop\evanhyd.github.io\articles\kittyengine-development-timeline.md'
with open(new_path, 'w', encoding='utf-8') as f:
    f.write(full_doc)

if os.path.exists(old_path):
    os.remove(old_path)

print(f'Successfully generated {new_path}')
print(f'File size: {len(full_doc)} bytes')
