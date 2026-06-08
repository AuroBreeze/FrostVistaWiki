---
icon: lucide/wrench
---

# 交叉编译器

## 什么是交叉编译

日常开发中，编译和运行通常在同一台机器上进行——你在 x86_64 Linux 上写代码，用 x86_64 的 gcc 编译，在 x86_64 Linux 上运行。这叫**本机编译**（native compilation）。

写 OS 的时候，目标平台往往不是你手边的开发机。FrostVistaOS 跑在 RISC-V 64 虚拟机上，但你的开发机是 x86_64。这时就需要**交叉编译**（cross compilation）：

```text
Host (x86_64 Linux)  ──交叉编译器──►  Target (RISC-V 64)
        你在这里写代码                      内核在这里运行
```

```mermaid
graph LR
    A[源代码 .c / .S] --> B[交叉编译器 riscv64-*-gcc]
    B --> C[RISC-V 64 目标文件 .o]
    C --> D[链接器 riscv64-*-ld]
    D --> E[kernel.elf]
    E --> F[qemu-system-riscv64]
```

交叉编译器本身运行在 Host 上，但生成的是 Target 平台的机器码。

!!! note ""
    如果你用 `file` 命令查看编译产物，会看到类似：
    ```
    kernel.elf: ELF 64-bit LSB executable, UCB RISC-V, ...
    ```
    这说明生成的是 RISC-V 可执行文件，而不是 x86_64 文件。

---

## 工具链前缀

RISC-V 交叉编译器有几种常见前缀，区别在于**目标三元组**（target triple）不同：

| 前缀 | ABI | 适用场景 |
|------|-----|---------|
| `riscv64-elf-` | bare-metal | 裸机程序，无操作系统 |
| `riscv64-unknown-elf-` | bare-metal | 同上，但带 vendor 字段 |
| `riscv64-linux-gnu-` | Linux | 有 Linux 用户态的程序 |

FrostVistaOS 是裸机内核，理论上三种都可以使用。

选择时，FrostVistaOS 的 `mk/arch-riscv.mk` 会按优先级自动检测：

```text
1. riscv64-elf-gcc
2. riscv64-unknown-elf-gcc
3. riscv64-linux-gnu-gcc
```

你也可以手动指定 `CROSS`：

```bash
make qemu CROSS=riscv64-unknown-elf
```

!!! tip "安装工具链"
    推荐直接安装发行版仓库提供的包。Arch 下：
    ```bash
    sudo pacman -S riscv64-elf-gcc riscv64-elf-binutils
    ```

---

## 工具链包含哪些工具

一个完整的 GNU 工具链通常包含：

| 工具 | 作用 |
|------|------|
| `$(CROSS)-gcc` | C 编译器（编译 `.c` 为 `.o`） |
| `$(CROSS)-as` | 汇编器（汇编 `.S` 为 `.o`） |
| `$(CROSS)-ld` | 链接器（合并 `.o` 为 ELF） |
| `$(CROSS)-objdump` | 反汇编、查看段信息 |
| `$(CROSS)-objcopy` | 格式转换（ELF → binary 等） |
| `$(CROSS)-readelf` | 查看 ELF 头、段、符号表 |
| `$(CROSS)-ar` | 打包静态库 |
| `$(CROSS)-gdb` | RISC-V 平台的调试器 |

FrostVistaOS 构建系统中直接使用的有 `CC`（= `$(CROSS)-gcc`）和 `DUMP`（= `$(CROSS)-objdump`）。

---

## 常用编译选项

FrostVistaOS 的 `ARCH_CFLAGS` 定义在 `mk/arch-riscv.mk` 中：

```makefile
ARCH_CFLAGS = -march=rv64imac_zicsr_zifencei -mabi=lp64 -mcmodel=medany
```

| 选项 | 含义 |
|------|------|
| `-march=rv64imac_zicsr_zifencei` | RISC-V 64 位，含整数、乘除、原子、压缩指令，CSR 和 fence 扩展 |
| `-mabi=lp64` | 64 位指针和 `long`，整数 ABI |
| `-mcmodel=medany` | 中等代码模型，允许数据和代码在 2 GiB 范围内任意放置 |

调试构建还会加上：

| 选项 | 含义 |
|------|------|
| `-O0` | 关闭优化，方便 GDB 单步调试 |
| `-g` | 生成调试信息（DWARF） |

!!! warning "不要用 -O0 日常运行"
    `-O0` 会显著增大内核体积并降低运行速度。日常验证只需用 `BUILD=release`（默认）。调试时再切换 `BUILD=debug`。

---

## elf vs linux-gnu 两种 target 有什么区别

| | `riscv64-elf` | `riscv64-linux-gnu` |
|---|---|---|
| 目标 | 裸机 | Linux 用户态 |
| 默认链接脚本 | 无 OS 支持 | 含 Linux 启动逻辑 |
| `-lc` 等自动链接 | 否 | 是 |
| 适合内核 | **是** | 可用（需小心） |

FrostVistaOS 使用自己的链接脚本（`linker.ld` / `linker-sbi.ld`），并禁用标准库和启动文件，所以两种 target 的实际行为在这里差异不大。

---

## 如何验证工具链

安装后，确认编译器能找到：

```bash
riscv64-elf-gcc --version
```

确认可以交叉编译一个最小程序：

```bash
echo 'int _start() { return 0; }' > /tmp/test.c
riscv64-elf-gcc -nostdlib -o /tmp/test.elf /tmp/test.c
file /tmp/test.elf
# 应输出: test.elf: ELF 64-bit LSB executable, UCB RISC-V, ...
```

---

## 下一步

- [Linker 与 ELF](linker-elf.md) — 理解链接过程和 ELF 文件结构
- [构建与运行](../getting-started/build-and-run.md) — 用 Makefile 完整构建并启动内核
