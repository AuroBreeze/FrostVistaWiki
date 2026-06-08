---
icon: lucide/settings
---

# 环境配置

本文默认开发环境为：

- Host：x86_64 Linux
- Distribution：Arch Linux
- Target：RISC-V 64
- Emulator：QEMU virt
- Kernel：FrostVistaOS

## 目标

配置完成后，应该能完成以下事情：

- 编译 FrostVistaOS 内核
- 构建用户态测试程序
- 生成 Easy-FS 磁盘镜像
- 使用 QEMU 启动系统
- 使用 GDB 调试内核
- 运行自动化测试脚本

## 系统环境

Arch Linux 下先安装基础开发工具：

```bash
sudo pacman -S --needed base-devel make gcc python
```

这些工具用于：

- `make`：驱动 FrostVistaOS 的构建流程。
- `gcc`：编译 host-side 工具，例如 `mkfs/mkfs.c`。
- `python3`：运行 `scripts/run_tests.py` 自动化测试脚本。

## RISC-V 工具链

安装 RISC-V cross compiler、binutils 和 GDB：

```bash
sudo pacman -S --needed riscv64-elf-gcc riscv64-elf-binutils riscv64-elf-gdb
```

FrostVistaOS 会在 `mk/arch-riscv.mk` 中自动选择 cross toolchain，优先级如下：

```text
riscv64-elf-gcc
riscv64-unknown-elf-gcc
riscv64-linux-gnu-gcc
```

如果你的工具链前缀不同，可以手动指定 `CROSS`：

```bash
make qemu CROSS=riscv64-elf
```

检查编译器：

```bash
riscv64-elf-gcc --version
```

## QEMU

安装 RISC-V system emulator：

```bash
sudo pacman -S --needed qemu-system-riscv
```

检查 QEMU：

```bash
qemu-system-riscv64 --version
```

FrostVistaOS 使用的 QEMU 目标是 `virt` machine，核心启动参数由 `mk/run.mk` 生成：

```text
qemu-system-riscv64 -machine virt -nographic ...
```

## GDB

如果前面已经安装了 `riscv64-elf-gdb`，可以直接检查：

```bash
riscv64-elf-gdb --version
```

调试时使用两个终端。

终端 1 启动 QEMU，并停在等待 GDB 的状态：

```bash
make debug BOOT=opensbi ROOTFS=ext4 FS_LIST="ext4 devtmpfs" TEST=runner
```

终端 2 连接 GDB：

```bash
make gdb
```

`make gdb` 内部会执行类似命令：

```bash
riscv64-elf-gdb build/kernel.elf -ex 'target remote :1234'
```

## Python 与测试脚本

FrostVistaOS 的自动化测试脚本是：

```text
scripts/run_tests.py
```

它会构建指定测试、启动 QEMU、收集日志，并检查 PASS / FAIL 标记。

列出所有测试：

```bash
python3 ./scripts/run_tests.py --list
```

运行 shell 回归测试：

```bash
python3 ./scripts/run_tests.py -t fvsh_script -T 30
```

运行 pipe 测试：

```bash
python3 ./scripts/run_tests.py -t sys_pipe -T 20 --skip-kernel
```

运行 Easy-FS 测试：

```bash
python3 ./scripts/run_tests.py -t easyfs -T 20 --skip-kernel
```

重新检查已有日志：

```bash
python3 ./scripts/run_tests.py --check logs/
```

## Zensical 文档环境

如果你同时维护 FrostVista Wiki，需要安装 Zensical：

```bash
pip install zensical
```

本地预览：

```bash
zensical serve
```

构建静态站点：

```bash
zensical build --clean
```

生成目录是 `site/`，已经被 wiki 仓库的 `.gitignore` 忽略。

## 验证环境

进入 FrostVistaOS 项目根目录：

```bash
cd FrostVistaOS
```

启动默认 Easy-FS + shell 环境：

```bash
make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

如果一切正常，你应该能看到内核启动日志，并进入 FrostVista shell。

OpenSBI + EXT4 runner 路径：

```bash
make qemu BOOT=opensbi ROOTFS=ext4 FS_LIST="ext4 devtmpfs" TEST=runner BUILD=debug
```

这一路径默认使用项目根目录下的：

```text
sdcard-rv.img
```

常用构建参数：

| 参数 | 示例 | 含义 |
|------|------|------|
| `BOOT` | `bare` / `opensbi` | 启动方式 |
| `ROOTFS` | `easyfs` / `ext4` | 根文件系统 |
| `FS_LIST` | `"easyfs devtmpfs"` | 编译启用哪些文件系统 |
| `TEST` | `fvsh` / `runner` | 选择 `test/test_*.c` 作为 `/init` |
| `BUILD` | `release` / `debug` | 优化或调试构建 |
| `LOG` | `TRACE` / `DEBUG` / `INFO` | 日志级别 |
| `CROSS` | `riscv64-elf` | 手动指定工具链前缀 |

## 常见问题

### 找不到 `riscv64-elf-gcc`

检查是否安装 RISC-V cross GCC：

```bash
riscv64-elf-gcc --version
```

如果你的工具链叫 `riscv64-unknown-elf-gcc`，可以使用：

```bash
make qemu CROSS=riscv64-unknown-elf
```

### 找不到 `qemu-system-riscv64`

确认安装了 QEMU RISC-V system emulator：

```bash
qemu-system-riscv64 --version
```

### 找不到 `xxd`

Arch Linux 下 `xxd` 通常由 `vim` 包提供：

```bash
sudo pacman -S --needed vim
```

即使没有 `xxd`，FrostVistaOS 的 Makefile 也会 fallback 到 `od + awk` 生成 `init_code.h`，但仍然建议安装 `xxd`。

### EXT4 runner 启动失败

确认项目根目录存在：

```text
sdcard-rv.img
```

这是 `ROOTFS=ext4` 路径默认使用的镜像文件。

### 切换 ROOTFS 后行为不对

切换 Easy-FS / EXT4 后，建议先清理再运行：

```bash
make clean
make qemu BOOT=opensbi ROOTFS=ext4 FS_LIST="ext4 devtmpfs" TEST=runner BUILD=debug
```
