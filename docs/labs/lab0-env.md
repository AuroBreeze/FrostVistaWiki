---
icon: lucide/settings
---

# Lab 0 环境配置

Lab 0 的目标不是重新讲一遍工具怎么安装，而是确认你的环境已经能支撑后续实验。

如果你还没有安装工具链、QEMU 或 GDB，请先阅读[环境配置](../getting-started/environment.md)。完成安装后，再回到本实验做验证。

## 目标

完成本实验后，你应该能够确认：

- RISC-V 交叉编译工具链可用；
- QEMU RISC-V system emulator 可用；
- FrostVistaOS 能通过 Easy-FS 路径启动；
- 自动化测试脚本能运行并给出结果；
- 如果需要调试，GDB 能连接到 QEMU 的调试端口。

!!! note
    后续实验默认你已经完成 Lab 0。遇到构建、启动或测试异常时，也可以回到本页重新检查环境。

## 前置准备

进入 FrostVistaOS 项目根目录：

```bash
cd FrostVistaOS
```

本文后续命令都默认在这个目录下执行。

## Step 1 检查基础工具

先确认基础开发工具存在：

```bash
make --version
gcc --version
python3 --version
```

这些命令只要能正常输出版本信息即可。

再检查 RISC-V 交叉编译器。下面三个命令不需要全部成功，只要其中一个可用即可：

```bash
riscv64-elf-gcc --version
riscv64-unknown-elf-gcc --version
riscv64-linux-gnu-gcc --version
```

!!! tip "推荐工具链"
    为避免不必要的问题，后续开发建议优先使用 `riscv64-elf-gcc`，这是本项目默认的工具链。

FrostVistaOS 会自动尝试选择可用的工具链前缀。若你的环境中有多个工具链，或者自动选择失败，可以手动指定 `CROSS`：

```bash
make qemu CROSS=riscv64-elf
```

检查 QEMU：

```bash
qemu-system-riscv64 --version
```

如果你准备使用调试功能，也可以检查 GDB。下面几个命令同样只要有一个可用即可：

```bash
riscv64-elf-gdb --version
riscv64-unknown-elf-gdb --version
riscv64-linux-gnu-gdb --version
gdb-multiarch --version
gdb --version
```

## Step 2 启动 FrostVistaOS

Lab 0 推荐使用 Easy-FS 路径启动系统：

```bash
make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

这个命令会完成几件事：

- 构建用户态测试程序；
- 构建内核；
- 生成 Easy-FS 镜像；
- 启动 QEMU；
- 运行 `fvsh` 作为初始用户程序。

如果环境正确，你应该能看到内核启动日志，并进入 FrostVista shell。

!!! warning "优先使用 Easy-FS"
    EXT4 路径主要用于特定测试和兼容场景。日常实验验证建议优先使用 `ROOTFS=easyfs`。

## Step 3 运行自动化测试

确认系统能启动之后，再运行一个自动化测试：

```bash
./scripts/run_tests.sh -t fvsh_script -T 30
```

如果你想直接使用 Python 脚本，也可以运行：

```bash
python3 ./scripts/run_tests.py -t fvsh_script --rootfs easyfs --fs-list "easyfs devtmpfs" -T 30
```

测试脚本会自动构建、启动 QEMU、收集输出，并检查测试结果。

## Step 4 阅读 工具 页面（可选）

**工欲善其事，必先利其器**

阅读 **工具** 页面，了解 FrostVistaOS 的工具链、QEMU、GDB 等工具。

## Step 5 连接 GDB（可选）

如果你只是想继续后续实验，可以跳过本节。若你希望确认调试环境可用，可以打开两个终端。

终端 1 启动 QEMU 并等待 GDB：

```bash
make debug ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

终端 2 连接 GDB：

```bash
make gdb
```

如果 `make gdb` 找不到和 `CROSS` 匹配的 GDB，可以手动使用 `gdb-multiarch`：

```bash
gdb-multiarch build/kernel.elf -ex 'target remote :1234'
```

能连接到 `:1234` 并停在内核入口附近，就说明基础调试链路是通的。



## 成功标准

完成 Lab 0 时，你至少应该满足：

- `make`、`gcc`、`python3` 能输出版本信息；
- 至少一个 RISC-V GCC 可用；
- `qemu-system-riscv64` 可用；
- `make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh` 能启动系统；
- `./scripts/run_tests.sh -t fvsh_script -T 30` 能运行并给出测试结果。
- 简单的了解交叉编译工具链，QEMU，GDB 的使用方法。

GDB 不是进入后续实验的硬性要求，但建议尽早配置好。OS 实验里，调试能力往往比一次性跑通更重要。

## 记录与思考

建议你在自己的实验记录里写下：

- 使用的 Linux 发行版；
- 可用的 RISC-V 工具链前缀；
- QEMU 版本；
- 成功启动系统时使用的完整命令，命令可以改动成什么？；
- 自动化测试的结果；
- `ROOTFS=easyfs` 和 `FS_LIST="easyfs devtmpfs"` 分别在命令中影响了什么变量？他们的选择会最终使编译输出产生什么变化？

最后一个问题不要求你现在完全理解。先尝试用自己的话解释，后面的文件系统实验会继续展开。

## 常见问题

### 找不到 RISC-V GCC

先确认至少有一个交叉编译器可用：

```bash
riscv64-elf-gcc --version
riscv64-unknown-elf-gcc --version
riscv64-linux-gnu-gcc --version
```

如果工具链存在，但项目没有自动选中，可以手动传入 `CROSS`：

```bash
make qemu CROSS=riscv64-unknown-elf ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

### 找不到 QEMU

确认系统中存在 RISC-V system emulator：

```bash
qemu-system-riscv64 --version
```

如果命令不存在，请回到[环境配置](../getting-started/environment.md)检查对应发行版的安装命令。

### 启动后行为不符合预期

切换过 `ROOTFS`、`TEST` 或其他构建参数后，建议先清理再运行：

```bash
make clean
make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

### GDB 连接失败

确认终端 1 使用的是 `make debug`，而不是普通的 `make qemu`。普通启动不会停下来等待 GDB。

如果 `make gdb` 找不到命令，说明项目推导出的 `$(CROSS)-gdb` 不存在。可以安装对应 GDB，或临时使用：

```bash
gdb-multiarch build/kernel.elf -ex 'target remote :1234'
```

## 下一步

环境验证完成后，就可以进入 [Lab 1 Hello Kernel](lab1-hello-kernel.md)。
