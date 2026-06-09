---
icon: lucide/lock-keyhole
---

# 锁

Trap 章讲完以后，系统已经能从用户态进入内核，也能响应 timer interrupt。

但这也带来了一个新问题：内核代码不再是“一条路走到底”了。

一个进程可能正在内核里修改数据，timer interrupt 来了，调度器把 CPU 切给另一个进程。另一个进程也进内核，也想改同一份数据。再往后，VirtIO、pipe、文件系统都会让进程睡眠、唤醒、重新调度。

如果这些共享状态没有保护，内核很快就会把自己的数据结构写坏。

所以，在进入进程章之前，先把 FrostVistaOS 里的锁讲清楚。

!!! tip "本章的读法"
    抓住三件事：**锁保护共享状态**，**spinlock 不能睡眠**，以及 **sleeplock 依赖进程和调度器**。

    后面进程、pipe、文件系统章节会反复回到这些概念。

## 为什么 Trap 之后要讲锁

启动、分页、trap 这些章节里，大部分代码看起来都像“按顺序执行”。

但 timer interrupt 出现以后，这个直觉就不够用了。

```text
进程 A 进入内核，正在修改共享数据
    ↓
timer interrupt 到来
    ↓
trap handler 调用 yield()
    ↓
调度器切到进程 B
    ↓
进程 B 也进入内核，修改同一份共享数据
```

这里的关键不是“有几个 CPU”，而是：**内核执行流可能在共享数据修改到一半时被打断。**

就算只有一个 CPU，只要中断和调度存在，内核就必须认真处理并发问题。后面多核起来以后，这个问题只会更明显。

FrostVistaOS 里最早能看到锁的地方，是上一章已经用过的物理页分配器：

```c
// kernel/mm/kalloc.c
struct spinlock mem_lock;

void *kalloc()
{
    acquire(&mem_lock);
    // 省略空链表检查，只看成功分配时的链表修改

    struct IdleMM *temp = head.next;
    head.next = temp->next;
    FMM.size--;

    release(&mem_lock);
    memset(temp, 0, PGSIZE);
    return (void *)temp;
}
```

`head.next` 和 `FMM.size` 是全局共享状态。只要两个执行流同时改它们，空闲链表就可能断掉、成环，或者把同一页分配给两个人。

锁要解决的就是这件事：**一段时间内，只允许一个执行流进入临界区。**

## 没有锁会坏在哪里

先看 `kalloc()`。

假设空闲链表长这样：

```text
head -> A -> B -> C
```

两个执行流同时分配物理页。如果没有锁，可能发生这样的交错：

```text
CPU/执行流 1: temp = head.next    // temp = A
CPU/执行流 2: temp = head.next    // temp = A
CPU/执行流 1: head.next = A->next // head -> B
CPU/执行流 2: head.next = A->next // head -> B
```

结果是：A 被返回了两次。同一页物理内存被两个地方同时使用，后面的页表、进程、文件缓存都会出现诡异错误。

再看 pipe。

```c
// kernel/core/pipe.c
acquire(&pi->lock);
while (pi->nread == pi->nwrite && pi->writable) {
    sleep(&pi->nread, &pi->lock);
}
...
pi->nread++;
wakeup(&pi->nwrite);
release(&pi->lock);
```

`nread`、`nwrite`、`readable`、`writable` 共同描述一个 pipe 的状态。如果读者和写者不通过同一把锁协调，就可能出现：明明有数据却睡了、明明没空间却继续写、或者唤醒丢失。

所以不要把锁理解成“为了多核才需要的东西”。在 OS 里，只要有共享状态、trap、调度、设备中断，就需要锁。

## spinlock：短临界区里原地等

FrostVistaOS 的自旋锁结构很小：

```c
// include/kernel/spinlock.h
struct spinlock {
    uint locked;
    char *name;
    struct cpu *cpu;
};
```

三个字段分别表示：

| 字段 | 含义 |
|------|------|
| `locked` | 锁当前是否被持有 |
| `name` | 锁名，主要用于调试 |
| `cpu` | 当前持有这把锁的 CPU |

获取锁的核心在 `acquire()`：

```c
void acquire(struct spinlock *lk)
{
    push_off();

    if (holding(lk)) {
        panic("acquire: already holding lock");
    }
    while (__sync_lock_test_and_set(&lk->locked, 1) != 0)
        ;
    __sync_synchronize();

    lk->cpu = get_cpu();
}
```

最关键的是这一行：

```c
while (__sync_lock_test_and_set(&lk->locked, 1) != 0)
    ;
```

它做的是原子交换：把 `lk->locked` 设成 1，并返回旧值。

```text
旧值 = 0 → 说明没人持锁，本次成功拿到锁
旧值 = 1 → 说明锁已经被别人拿走，继续原地循环
```

这就是 spinlock 的“spin”：拿不到锁时不睡眠、不让出 CPU，而是在原地一直试。

释放锁对应 `release()`：

```c
void release(struct spinlock *lk)
{
    if (!holding(lk)) {
        panic("release: not holding lock");
    }
    lk->cpu = 0;
    __sync_synchronize();
    __sync_lock_release(&lk->locked);

    pop_off();
}
```

`__sync_synchronize()` 是内存屏障，防止编译器或 CPU 把临界区内的内存访问重排到加锁之前或解锁之后。对于锁来说，互斥只是第一步，还必须保证临界区里的读写顺序不会被乱挪。

!!! warning "spinlock 不支持重入"
    同一个执行流不能重复获取同一把 spinlock。`acquire()` 里会调用 `holding(lk)` 检查，如果当前 CPU 已经持有这把锁，再次获取会直接 panic。

## 为什么 acquire 要关中断

`acquire()` 第一行不是原子交换，而是：

```c
push_off();
```

这一步很容易被忽略，但它是 spinlock 正确性的关键。

想象一个场景：

```text
内核代码持有 mem_lock
    ↓
timer interrupt 到来
    ↓
进入 trap handler
    ↓
trap handler 或后续路径又想获取 mem_lock
```

如果中断没有被关掉，当前 CPU 会在已经持有 `mem_lock` 的时候，再次尝试获取同一把锁。由于锁不会自己释放，CPU 就会永远卡在自旋循环里。

所以 FrostVistaOS 在获取 spinlock 前会关闭当前 CPU 的中断，释放最后一层 spinlock 后再恢复中断状态。

这里不能简单写成：

```c
intr_off();
...
intr_on();
```

因为关中断可能是嵌套的。

```c
void push_off(void)
{
    int old = intr_get();
    intr_off();

    struct cpu *c = get_cpu();
    if (c->noff == 0) {
        c->intena = old;
    }
    c->noff++;
}
```

`push_off()` 记录两件事：

| 字段 | 含义 |
|------|------|
| `noff` | 当前 CPU 上关中断的嵌套层数 |
| `intena` | 最外层 `push_off()` 之前，中断是否本来就是开的 |

`pop_off()` 只有在嵌套层数回到 0，并且最开始中断是开的情况下，才会重新开中断：

```c
void pop_off(void)
{
    if (intr_get()) {
        panic("pop_off: interrupt enabled\n");
    }
    struct cpu *c = get_cpu();
    if (c->noff < 1) {
        panic("pop_off");
    }
    c->noff--;
    if (c->noff == 0 && c->intena) {
        intr_on();
    }
}
```

`push_off()` / `pop_off()` 是**当前 CPU 级别**的中断状态管理，不是某一把锁自己的状态。

## holding：检查锁时也要小心

`holding()` 用来判断当前 CPU 是否持有某把锁：

```c
int holding(struct spinlock *lk)
{
    int r;
    push_off();
    r = (lk->locked && lk->cpu == get_cpu());
    pop_off();
    return r;
}
```

它内部也会 `push_off()`。

原因很直接：检查 `lk->locked` 和 `lk->cpu` 这两个字段时，也不希望当前 CPU 被中断打断。否则你以为自己正在做一个普通判断，实际读到的可能是被中断路径改到一半的状态。

这也是为什么 `push_off()` / `pop_off()` 必须支持嵌套。`acquire()` 里调用 `holding()`，而 `holding()` 自己也会关中断。如果没有 `noff` 计数，内层 `pop_off()` 一开中断，外层 `acquire()` 的保护就被破坏了。

## sleep / wakeup：不能一直自旋的时候怎么办

spinlock 适合保护很短的临界区，比如改一个链表头、改一个计数器。

但有些等待不能靠自旋解决。

比如 pipe 读：如果 pipe 现在没有数据，读进程总不能一直占着 CPU 空转。它应该睡眠，等写进程写入数据后再被唤醒。

FrostVistaOS 的 `sleep()` 在 `spinlock.c` 里：

```c
void sleep(void *chan, struct spinlock *lk)
{
    struct Process *p = get_proc();

    if (lk != &p->lock) {
        acquire(&p->lock);
        release(lk);
    }

    p->chan = chan;
    p->state = SLEEPING;

    sched();

    p->chan = 0;

    if (lk != &p->lock) {
        release(&p->lock);
        acquire(lk);
    }
}
```

这里最容易看漏的是：`sleep(chan, lk)` 不是简单地“睡一下”。它做了一个非常关键的锁交接：

```text
1. 拿到当前进程的 p->lock
2. 释放调用者传进来的 lk
3. 把当前进程标记为 SLEEPING
4. 调用 sched() 切走
5. 被唤醒回来后，重新拿回 lk
```

为什么要这样？因为调用者通常是在持有某个资源锁时发现条件不满足。

以 pipe 读为例：

```c
acquire(&pi->lock);
while (pi->nread == pi->nwrite && pi->writable) {
    sleep(&pi->nread, &pi->lock);
}
```

如果读进程睡眠时不释放 `pi->lock`，写进程就拿不到 `pi->lock`，也就没法写入数据，更没法 `wakeup()` 它。系统会死锁。

但如果先释放 `pi->lock`，再把自己标记为 `SLEEPING`，中间又可能发生唤醒丢失。

所以 `sleep()` 必须把“释放外部锁”和“进入睡眠状态”组织成一个安全的交接过程。这也是它必须依赖 `p->lock` 和 `sched()` 的原因。

唤醒逻辑在 `wakeup()`：

```c
void wakeup(void *chan)
{
    struct Process *p;
    extern struct Process proc[64];

    for (int i = 0; i < 64; i++) {
        p = &proc[i];
        acquire(&p->lock);
        if (p != get_proc() && p->chan == chan &&
            p->state == SLEEPING) {
            p->state = RUNNABLE;
        }
        release(&p->lock);
    }
}
```

`chan` 不是一个真实的队列对象。它只是一个等待原因的标记。睡眠者把 `p->chan` 设成某个地址，唤醒者用同一个地址去找它。

```text
pipe 读者睡在 &pi->nread
pipe 写者写入数据后 wakeup(&pi->nread)
```

## sleep 和 sleeplock 的区别

这里很容易把 `sleep()` 和 `sleeplock` 混在一起。

它们名字都带 sleep，但不是同一类东西。

```text
sleep()      是调度原语：让当前进程睡眠，等别人 wakeup()
sleeplock    是锁：保护某个可能要等很久的资源
```

更准确地说：**sleep 是 sleeplock 的底层机制之一，但 sleep 本身不是锁。**

| 对比 | `sleep(chan, lk)` | `sleeplock` |
|------|-------------------|-------------|
| 本质 | 让当前进程进入 `SLEEPING` 状态 | 一种可以睡眠等待的锁 |
| 保护资源吗 | 不直接保护资源 | 保护某个共享资源 |
| 是否有锁状态 | 没有自己的 `locked` 字段 | 有 `locked`、`pid`、内部 `spinlock` |
| 等待什么 | 等某个 `chan` 被 `wakeup(chan)` 唤醒 | 等这把 sleeplock 被释放 |
| 典型调用者 | pipe、wait、virtio 等阻塞路径 | buffer cache、inode 等长时间占用资源 |
| 依赖什么 | 当前进程、`p->lock`、调度器 | `spinlock` + `sleep/wakeup` + 当前进程 |

可以这样理解调用关系：

```text
acquiresleep(lk)
    ├── acquire(&lk->lock)       // 用内部 spinlock 保护 sleeplock 状态
    ├── while (lk->locked)
    │       sleep(lk, &lk->lock) // 拿不到 sleeplock 时才睡眠
    ├── lk->locked = 1
    └── release(&lk->lock)
```

也就是说，`sleep()` 只负责“当前进程怎么安全地睡下去、醒来后怎么继续”；`sleeplock` 负责“这个资源现在有没有被别人占用、谁占用了、释放时唤醒谁”。

如果把两者混起来，就很容易产生一个误解：以为只要调用了 `sleep()`，某个资源就自动被保护了。实际上不是。资源保护仍然要靠外层的锁协议来完成。

## sleeplock：长时间等待就睡眠

有了 `sleep()` / `wakeup()`，就可以实现 sleeplock。

spinlock 的特点是：拿不到就原地等。sleeplock 的特点是：拿不到就睡眠。

FrostVistaOS 的 sleeplock 结构是：

```c
// include/kernel/sleeplock.h
struct sleeplock {
    int locked;
    struct spinlock lock;

    char *name;
    int pid;
};
```

注意它内部还有一把 `spinlock`。这把内部 spinlock 不是用来保护外部资源本身，而是用来保护 sleeplock 自己的状态：`locked` 和 `pid`。

获取 sleeplock：

```c
void acquiresleep(struct sleeplock *lk)
{
    acquire(&lk->lock);
    while (lk->locked) {
        sleep(lk, &lk->lock);
    }
    lk->locked = 1;
    lk->pid = get_proc()->pid;
    release(&lk->lock);
}
```

释放 sleeplock：

```c
void releasesleep(struct sleeplock *lk)
{
    acquire(&lk->lock);
    lk->locked = 0;
    lk->pid = 0;
    wakeup(lk);
    release(&lk->lock);
}
```

这段代码可以这样读：

```text
如果 sleeplock 空闲：
    标记 locked = 1，记录 pid，返回

如果 sleeplock 已经被占用：
    当前进程睡在 lk 这个 chan 上
    等释放者 wakeup(lk)
    醒来后重新检查 locked
```

这里用 `while` 而不是 `if`，是因为醒来不等于一定拿到锁。可能多个进程都被唤醒了，只有一个能成功把 `locked` 改成 1，其他进程要继续睡。

## 启动早期为什么不能随便用 sleeplock

```text
acquiresleep()
  -> sleep()
     -> get_proc()
     -> sched()
```

sleeplock 不是只依赖一把 spinlock。它还依赖当前 CPU 上有正在运行的进程，依赖调度器能把这个进程切走，依赖之后有人能把它唤醒。

在 OS 初始化早期，进程和调度器还没真正跑起来。如果这时候进入 `virtblk_rw()`、文件系统读写、buffer cache 等可能睡眠的路径，就会遇到“需要进程上下文”的问题。

这也是为什么 FrostVistaOS 的启动流程要很小心地区分阶段：

```text
启动早期：可以用 spinlock 保护短临界区
进程/调度器起来之后：才能安全使用 sleep/wakeup 和 sleeplock
```

## spinlock 和 sleeplock 怎么选

可以先用这张表建立直觉：

| 问题 | 用什么 |
|------|--------|
| 临界区很短，只是改几个字段 | `spinlock` |
| 等待期间不能让出 CPU | `spinlock` |
| 可能等很久，比如磁盘 I/O、buffer 被占用 | `sleeplock` |
| 当前阶段还没有进程/调度器 | 不能用 `sleeplock` |
| 持锁时可能睡眠 | 不要持有普通 `spinlock` 睡眠，交给 `sleep(chan, lk)` 做锁交接 |

FrostVistaOS 里的例子也很典型：

```text
kalloc 空闲链表         -> spinlock
pipe 读写状态           -> spinlock + sleep/wakeup
buffer cache 单个 buffer -> sleeplock
inode 内容访问           -> sleeplock
进程状态切换            -> proc->lock（spinlock）
```

进程状态切换会有一个更特殊的现象：锁可能在一个执行流里获取，却在另一个执行流恢复后释放。4 月 devlog 里把这个叫“锁转移”。这部分要等进程章讲到 `scheduler()`、`yield()`、`sched()` 和 `swtch()` 时再完整展开。

## 本章先记住什么

这一章先记住四句话：

```text
spinlock:  保护短临界区，拿不到就在原地等
push_off:  获取 spinlock 前关闭当前 CPU 中断，并记录嵌套层数
sleep:     释放外部锁、标记进程睡眠、切换调度，醒来后重新拿锁
sleeplock: 基于 spinlock + sleep/wakeup，适合可能等待很久的资源
```

锁不是一个孤立模块。它一头连着 trap 和中断，另一头连着进程和调度器。

下一章进入进程以后，你会不断看到这些问题重新出现：为什么 `sched()` 要求持有 `p->lock`？为什么 `yield()` 先 `acquire(&p->lock)`？为什么 `sleep()` 要传入一把锁？

这些问题的答案，都从这一章开始。

## 下一步

- [进程](06-process.md)：调度器、`proc->lock`、`yield()` 和锁转移；
- [系统调用](07-syscall.md)：用户态如何通过 trap 进入 syscall 分发；
- [Pipe](10-pipe.md)：`sleep()` / `wakeup()` 如何在真实读写路径里配合使用。
