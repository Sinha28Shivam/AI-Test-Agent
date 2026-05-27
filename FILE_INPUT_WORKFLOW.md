# File-Based Input Workflow

## 📊 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User runs: npm start                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ getPromptFromSource() starts                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌─────────┐           ┌─────────┐
   │ CLI arg │           │ File    │
   │provided?│           │ input?  │
   └────┬────┘           └────┬────┘
        │                     │
    YES │ NO                  │
        │  │          ┌───────┴────────┬──────────┐
        │  │          │                │          │
        │  │          ▼                ▼          ▼
        │  │     test-input.yaml  test-input.json No file
        │  │          │                │          │
        │  │          ▼                ▼          ▼
        │  │      ┌────────────────────────────────────┐
        │  └──────►│ Check file existence               │
        │          │ & read content                     │
        │          └────────┬─────────────────────────┘
        │                   │
        │    ┌──────────────┴──────────────┐
        │    │                             │
        │    ▼                             ▼
        │ Success                       Error
        │    │                             │
        │    ▼                             ▼
        │ Parse YAML/JSON          Show helpful error
        │    │                       with all 3 options
        │    ▼                             │
        │ Validate prompt                 ▼
        │    │                         Exit(1)
        │    ▼
        └───►│
            │ Return prompt
            │
            ▼
   ┌─────────────────────┐
   │ orchestrator(prompt)│  ← Pass to main pipeline
   └─────────────────────┘
```

---

## 🔄 Input Priority Chain

```
┌─────────────────────────────────┐
│ 1. Command-Line Arguments       │ ← First priority (fastest)
│    npm start "test scenario"    │
└────────────┬────────────────────┘
             │
             │ If NOT provided
             ▼
┌─────────────────────────────────┐
│ 2. test-input.yaml              │ ← Second priority
│    (Multi-line, readable)       │
└────────────┬────────────────────┘
             │
             │ If NOT found
             ▼
┌─────────────────────────────────┐
│ 3. test-input.json              │ ← Third priority
│    (Structured format)          │
└────────────┬────────────────────┘
             │
             │ If NOT found
             ▼
┌─────────────────────────────────┐
│ 4. Show Error + Instructions    │ ← Last resort
│    Exit with helpful message    │
└─────────────────────────────────┘
```

---

## 📝 File Format Examples

### YAML Format (Recommended)
```
test-input.yaml
───────────────────────────────────
prompt: |
  Verify the MSN homepage
  loads correctly at 
  https://www.msn.com
───────────────────────────────────
```

**Advantages:**
- ✅ Multi-line support
- ✅ Human-readable
- ✅ Easy to comment
- ✅ Version control friendly

### JSON Format (Alternative)
```
test-input.json
───────────────────────────────────
{
  "prompt": "Verify MSN homepage"
}
───────────────────────────────────
```

**Advantages:**
- ✅ Structured format
- ✅ Strict validation
- ✅ Programmatic parsing

---

## 🚀 Usage Workflows

### Workflow 1: Simple Page Load
```
1. Edit test-input.yaml:
   prompt: Verify homepage loads at https://example.com

2. Run:
   npm start

3. Results appear in:
   reports/final/report.json
```

### Workflow 2: Complex Multi-Step Test
```
1. Edit test-input.yaml:
   prompt: |
     Test complete user flow:
     1. Navigate to https://myapp.com
     2. Fill login form
     3. Submit form
     4. Verify dashboard loads
     5. Check user profile page

2. Run:
   npm start

3. Results appear in:
   reports/final/report.json
```

### Workflow 3: Team Collaboration
```
1. Create test-input.yaml in repo
2. Team members clone repo
3. Each person can edit test-input.yaml
4. All run: npm start
5. Results shared in reports/
6. Commit changes to git
```

### Workflow 4: Quick CLI Override
```
1. You have test-input.yaml configured
2. Need to run different test quickly
3. Run:
   npm start "Quick test scenario"
4. CLI argument takes priority
5. Returns to file-based after this run
```

---

## ⚡ Execution Timeline

### Before (Terminal Input)
```
┌──────────┐
│ User     │
│ opens    │ ~5-10 seconds of manual work
│ terminal │
└────┬─────┘
     │
     ▼
┌──────────────────────────┐
│ Type long command:       │
│ npm start "test ......"  │ ← Error-prone
└────┬─────────────────────┘
     │
     ▼
┌────────────────────┐
│ Tests execute      │ ← Faster
└────────────────────┘
```

### After (File Input)
```
┌──────────┐
│ Edit     │ ← Can do once, reuse many times
│ YAML     │
│ file     │ ~1-2 seconds of manual work
└────┬─────┘
     │
     ▼
┌──────────────────────────┐
│ Run: npm start           │ ← Just hit run
│ (no typing needed)       │
└────┬─────────────────────┘
     │
     ▼
┌────────────────────┐
│ Tests execute      │ ← Same speed
└────────────────────┘
```

---

## 🎯 Decision Tree

```
START
  │
  ├─► Have test in mind?
  │   ├─► Yes ──► Use CLI: npm start "test"
  │   └─► No ──┐
  │            ▼
  │        Need to save/reuse?
  │        ├─► Yes ──► Edit test-input.yaml
  │        │           ▼
  │        │           Run: npm start
  │        └─► No ──► Just use CLI this time
  │
  ├─► Want readable format?
  │   ├─► Yes ──► Use YAML (test-input.yaml)
  │   └─► No ──► Use JSON (test-input.json)
  │
  ├─► Have multi-line prompt?
  │   ├─► Yes ──► Use YAML (supports multi-line)
  │   └─► No ──► Use JSON or YAML
  │
  └─► Run tests
      ▼
    Check results in reports/
```

---

## 📈 Comparison Matrix

| Feature | CLI | YAML | JSON |
|---------|-----|------|------|
| **Easy to use** | ❌ Long typing | ✅ Edit file | ✅ Edit file |
| **Multi-line** | ❌ Hard | ✅ Native | ⚠️ Escape chars |
| **Reusable** | ❌ Copy-paste | ✅ Keep file | ✅ Keep file |
| **Readable** | ❌ Terminal clutter | ✅ Very clean | ⚠️ Less clean |
| **Version control** | ❌ Script file | ✅ Easy | ✅ Easy |
| **Quick override** | ✅ Works | ⚠️ Ignored | ⚠️ Ignored |
| **Team sharing** | ❌ Share command | ✅ Share file | ✅ Share file |

---

## 🔐 File Locations

```
Project Root/
│
├── test-input.yaml              ← Primary input file
│   └─ Edit this with your tests
│
├── test-input.json              ← Secondary input file
│   └─ Use this as alternative
│
├── src/
│   ├── main.ts                  ← Modified (reads files)
│   └── ...other files...
│
└── reports/
    ├── raw/
    │   └── result.json          ← Raw test results
    └── final/
        └── report.json          ← Your final report
```

---

## ✅ Verification Checklist

When implementing, verify:

- [ ] `test-input.yaml` created in project root
- [ ] `test-input.json` created in project root
- [ ] `src/main.ts` updated with file reading logic
- [ ] All imports added (fs, path, yaml)
- [ ] `getPromptFromSource()` function implemented
- [ ] Priority checking order correct
- [ ] Error handling in place
- [ ] CLI args still work (backward compatible)
- [ ] YAML parsing works
- [ ] JSON parsing works
- [ ] Validation checks for empty prompts
- [ ] Helpful error messages displayed

---

## 🎓 Learning Path

1. **Quick Start**: Read `QUICK_START.md`
2. **First Test**: Edit `test-input.yaml`
3. **Run Test**: Execute `npm start`
4. **Check Results**: View `reports/final/report.json`
5. **Learn More**: Read `TEST_INPUT_GUIDE.md`
6. **Advanced**: Create multiple test scenarios
7. **Team Use**: Commit to git and share

---

## 📊 Impact Summary

```
Before: npm start "long test scenario..."
        ├─ ~50 keystrokes
        ├─ Error-prone
        ├─ Hard to reuse
        └─ Can't version control

After:  npm start
        ├─ 1 keystroke (literally!)
        ├─ Safe (editing file)
        ├─ Easy to reuse
        ├─ Can version control
        └─ Can share with team
```

---

**Your testing workflow just got a major upgrade! 🚀**
