---
icon: lucide/settings
---

# 环境配置

本文默认目标平台为：

- Host：x86_64 Linux
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

不同发行版的包名不完全相同。下面按工具拆分，每个工具下面再按发行版给出安装命令。

### 基础开发工具

这些工具用于驱动构建流程、编译 host-side 工具和运行测试脚本：

- `make`：驱动 FrostVistaOS 的构建流程。
- `gcc`：编译 host-side 工具，例如 `mkfs/mkfs.c`。
- `python3`：运行 `scripts/run_tests.py` 自动化测试脚本。
- `xxd`：生成部分内嵌二进制头文件；没有时 Makefile 会 fallback 到 `od + awk`。

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed base-devel make gcc python vim
    ```

    Arch Linux 下 `xxd` 通常由 `vim` 包提供。

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install build-essential make gcc python3 xxd
    ```

=== "Fedora"

    ```bash
    sudo dnf groupinstall "Development Tools"
    sudo dnf install make gcc python3 vim-common
    ```

检查基础工具：

```bash
make --version
gcc --version
python3 --version
xxd -h
```

### RISC-V 工具链

FrostVistaOS 需要 RISC-V 64 cross compiler 和 binutils。

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed riscv64-elf-gcc riscv64-elf-binutils
    ```

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf
    ```

    如果发行版仓库没有 `gcc-riscv64-unknown-elf`，也可以安装 Linux target 工具链：

    ```bash
    sudo apt install gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu
    ```

=== "Fedora"

    ```bash
    sudo dnf install gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu
    ```

    如果当前 Fedora 版本没有这些包，请安装发行版提供的 RISC-V cross toolchain，或手动安装 `riscv64-unknown-elf` / `riscv64-elf` 工具链。

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
riscv64-unknown-elf-gcc --version
riscv64-linux-gnu-gcc --version
```

只要上面任意一个命令可用即可。

### QEMU

FrostVistaOS 使用 QEMU RISC-V system emulator，目标 machine 是 `virt`。

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed qemu-system-riscv
    ```

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install qemu-system-misc
    ```

=== "Fedora"

    ```bash
    sudo dnf install qemu-system-riscv
    ```

检查 QEMU：

```bash
qemu-system-riscv64 --version
```

核心启动参数由 `mk/run.mk` 生成，形式类似：

```text
qemu-system-riscv64 -machine virt -nographic ...
```

### GDB

GDB 用于连接 QEMU 的 remote debugging stub。

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed riscv64-elf-gdb
    ```

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install gdb-multiarch
    ```

    `gdb-multiarch` 可以手动连接 QEMU 的 GDB stub。若要直接使用项目提供的 `make gdb`，更推荐安装和 `CROSS` 前缀匹配的 GDB，例如 `riscv64-unknown-elf-gdb`、`riscv64-elf-gdb` 或 `riscv64-linux-gnu-gdb`。

=== "Fedora"

    ```bash
    sudo dnf install gdb
    ```

    `gdb` 可以手动连接 QEMU 的 GDB stub。若要直接使用项目提供的 `make gdb`，更推荐安装和 `CROSS` 前缀匹配的 GDB，例如 `riscv64-unknown-elf-gdb`、`riscv64-elf-gdb` 或 `riscv64-linux-gnu-gdb`。

检查 GDB：

```bash
riscv64-elf-gdb --version
riscv64-unknown-elf-gdb --version
riscv64-linux-gnu-gdb --version
gdb-multiarch --version
gdb --version
```

如果要使用项目提供的 `make gdb`，需要确保 `$(CROSS)-gdb` 存在。例如 `CROSS=riscv64-elf` 时需要 `riscv64-elf-gdb`，`CROSS=riscv64-unknown-elf` 时需要 `riscv64-unknown-elf-gdb`。

调试时使用两个终端。

终端 1 启动 QEMU，并停在等待 GDB 的状态：

```bash
make debug ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

终端 2 连接 GDB：

```bash
make gdb
```

`make gdb` 内部会执行类似命令：

```bash
<CROSS>-gdb build/kernel.elf -ex 'set confirm off' -ex 'target remote :1234'
```

如果系统里只有 `gdb-multiarch`，可以手动连接：

```bash
gdb-multiarch build/kernel.elf -ex 'target remote :1234'
```

### Python 与测试脚本

Python 已包含在基础开发工具中。如果需要单独安装：

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed python
    ```

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install python3
    ```

=== "Fedora"

    ```bash
    sudo dnf install python3
    ```

FrostVistaOS 的自动化测试脚本是：

```text
scripts/run_tests.py
```

它会构建指定测试、启动 QEMU、收集日志，并检查 PASS / FAIL 标记。

```bash
python3 ./scripts/run_tests.py -h
```

列出所有自动化测试：

```bash
python3 ./scripts/run_tests.py --list
```

推荐优先使用 Easy-FS 路径运行测试：

```bash
python3 ./scripts/run_tests.py -t fvsh_script --rootfs easyfs --fs-list "easyfs devtmpfs" -T 30
```

仓库里也提供了一个默认走 Easy-FS 的 shell 测试入口：

```bash
./scripts/run_tests.sh -t fvsh_script -T 30
```

## 验证环境

进入 FrostVistaOS 项目根目录：

```bash
cd FrostVistaOS
```

启动默认 Easy-FS + shell 环境：

```bash
make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

这会通过项目的 `make qemu` 入口依次执行清理、构建用户测试、重建内核、生成 Easy-FS 镜像并启动 QEMU。如果一切正常，你应该能看到内核启动日志，并进入 FrostVista shell。

!!! warning "不推荐使用 EXT4 作为日常启动路径"

    EXT4 路径主要用于特定测试和兼容场景。当前 EXT4 支持是特定版本的只读模式，并且依赖项目根目录下的指定镜像文件；日常启动和实验验证建议优先使用上面的 Easy-FS 路径。

OpenSBI + EXT4 runner 路径：

```bash
make qemu BOOT=opensbi ROOTFS=ext4 FS_LIST="ext4 devtmpfs" TEST=runner BUILD=debug
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
| `EXT4_IMG` | `sdcard-rv.img` | EXT4 启动路径使用的外部镜像文件 |

## 常见问题

### 找不到 RISC-V GCC

先确认是否至少有一个 RISC-V cross compiler：

```bash
riscv64-elf-gcc --version
riscv64-unknown-elf-gcc --version
riscv64-linux-gnu-gcc --version
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

按发行版安装提供 `xxd` 的包：

=== "Arch Linux"

    ```bash
    sudo pacman -S --needed vim
    ```

=== "Ubuntu / Debian"

    ```bash
    sudo apt install xxd
    ```

=== "Fedora"

    ```bash
    sudo dnf install vim-common
    ```

即使没有 `xxd`，FrostVistaOS 的 Makefile 也会 fallback 到 `od + awk` 生成 `init_code.h`，但仍然建议安装 `xxd`。

### EXT4 runner 启动失败

EXT4 runner 不是推荐的日常启动路径，优先使用 `ROOTFS=easyfs` 验证环境。只有在需要复现 EXT4 相关测试时，再使用下面的检查项。

确认项目根目录存在：

```text
sdcard-rv.img
```

这是 `ROOTFS=ext4` 路径默认使用的镜像文件。

### 切换 ROOTFS 后行为不对

切换 Easy-FS / EXT4 后，建议先清理再运行：

```bash
make clean
make qemu ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```
