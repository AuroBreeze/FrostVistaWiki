---
icon: lucide/play
---

# 构建与运行

本文默认你已经完成[环境配置](environment.md)，并且当前终端位于 FrostVistaOS 项目根目录。

FrostVistaOS 推荐通过项目提供的 `make` 入口构建和运行。不要手动拼接 QEMU 命令，除非你正在调试 Makefile 本身。

如果你想理解 `make qemu` 背后的 QEMU 参数，可以先跑通本页命令，再阅读[QEMU](../tools/qemu.md)。

## 最短路径

启动 OpenSBI + Easy-FS + FrostVista shell：

```bash
make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

如果一切正常，你应该能看到内核启动日志，并进入 FrostVista shell。

运行结果类似如下：
```text
[   0.016] [ INFO] Paging enable successfully
------------------------------------------------------------
    ______                __ _    ___      __       
   / ____/________  _____/ /| |  / (_)____/ /_____ _
  / /_  / ___/ __ \/ ___/ __/ | / / / ___/ __/ __ `/
 / __/ / /  / /_/ (__  ) /_ | |/ / (__  ) /_/ /_/ / 
/_/   /_/   \____/____/\__/ |___/_/____/\__/\__,_/

RISC-V 64  |  Sv39  |  v1.0
------------------------------------------------------------
[   0.023] [ INFO] Enable time interrupts...
[   0.024] [ INFO] Timer init done
------------------------------------------------------------
  ◆ Platform Init
[   0.026] [ INFO] kalloc_init start
[   0.588] [ INFO] Total Memory Pages: 32531
[   0.589] [ INFO] kalloc_init end
[   0.589] [ INFO] clear low memory mappings
[   0.590] [ INFO] clear low memory mappings done
[   0.591] [ INFO] Hello FrostVista OS!
------------------------------------------------------------
  ◆ Process Subsystem
------------------------------------------------------------
  ◆ Filesystem & Devices
[   0.595] [ INFO] virtio-blk initialized, mmio version 2
------------------------------------------------------------
  ◆ Kernel Ready
Hello from the FrostVista shell!
fvsh>
```

`make qemu` 会依次完成：

1. 清理旧的构建产物。
2. 构建 `test/test_<TEST>.c` 对应的用户态测试程序。
3. 重新链接 `build/kernel.elf`。
4. 生成 Easy-FS 磁盘镜像 `build/disk.img`。
5. 启动 `qemu-system-riscv64`。

## 选择测试程序

`TEST=<name>` 的选择规则是：取测试文件名里 `test_` 后面的部分。

例如 `test/test_fvsh.c` 对应：

```text
TEST=fvsh
```

也就是说，`TEST=fvsh` 会构建：

```text
test/test_fvsh.c
```

常用启动命令：

=== "Shell"

    ```bash
    make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
    ```

=== "Runner"

    ```bash
    make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=runner
    ```

=== "Pipe"

    ```bash
    make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=sys_pipe
    ```

=== "Shell Script"

    ```bash
    make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh_script
    ```

列出自动化测试脚本识别的测试：

```bash
python3 ./scripts/run_tests.py --list
```

如果 `make qemu` 提示找不到测试文件，先确认项目中存在对应的：

```text
test/test_<name>.c
```

## 常用构建参数

| 参数 | 示例 | 含义 |
|------|------|------|
| `BOOT` | `opensbi` / `bare` | 启动方式，本文推荐 `opensbi` |
| `ROOTFS` | `easyfs` / `ext4` | 启动时挂载的根文件系统 |
| `FS_LIST` | `"easyfs devtmpfs"` | 编译进内核的文件系统列表 |
| `TEST` | `fvsh` / `runner` / `sys_pipe` | 选择 `test/test_*.c` 作为 `/init` |
| `BUILD` | `release` / `debug` | 构建优化级别，默认 `release` |
| `LOG` | `TRACE` / `DEBUG` / `INFO` | 内核日志级别 |
| `CROSS` | `riscv64-elf` | 手动指定 RISC-V 工具链前缀 |

Makefile 默认值来自 `mk/config.mk`：

想理解这些变量如何一路影响编译、镜像和 QEMU，可以阅读[Make](../tools/make.md)。

```text
BOOT=bare
ROOTFS=easyfs
FS_LIST=easyfs
TEST=runner
BUILD=release
```

虽然 Makefile 默认 `BOOT=bare`，但本文推荐显式写出 `BOOT=opensbi`，因为当前开发和调试重心在 OpenSBI 路径上。日常运行也建议显式写出 `ROOTFS` 和 `FS_LIST`，避免切换不同配置后产生误解。

## Easy-FS 镜像

当 `ROOTFS=easyfs` 时，Makefile 会生成并使用：

```text
build/disk.img
```

生成镜像时会做三件事：

1. 编译 host-side 工具 `build/mkfs_tool`。
2. 构建 `user/bin/` 下的用户程序。
3. 把 `/init` 和用户程序写入 Easy-FS 镜像。

所以只要使用 `make qemu BOOT=opensbi ROOTFS=easyfs ...`，通常不需要手动生成磁盘镜像。

## EXT4 路径

!!! warning "不推荐 EXT4 作为日常启动路径"

    EXT4 路径主要用于特定测试和兼容场景。当前 EXT4 支持是特定版本的只读模式，并且依赖项目根目录下的指定镜像文件；日常启动和实验验证建议优先使用 Easy-FS。

OpenSBI + EXT4 runner 示例：

```bash
make qemu BOOT=opensbi ROOTFS=ext4 FS_LIST="ext4 devtmpfs" TEST=runner BUILD=debug
```

这一路径默认使用：

```text
sdcard-rv.img
```

如果项目根目录没有这个镜像，EXT4 启动会失败。

## 自动化测试

!!! note "每个测试都会重建内核"

    `scripts/run_tests.py` 会为每个测试先构建对应的 `test/test_<name>.c`，再使用 `make -B build/kernel.elf ...` 强制重建内核。这是因为 `/init` 会通过 `init_code.h` 嵌入内核，切换 `TEST` 后必须重新链接，否则可能运行到上一个测试。

查看测试脚本帮助：

```bash
python3 ./scripts/run_tests.py -h
```

推荐优先使用 Easy-FS 路径运行测试：

```bash
python3 ./scripts/run_tests.py -t fvsh_script --rootfs easyfs --fs-list "easyfs devtmpfs" -T 30
```

仓库也提供了一个默认走 Easy-FS 的 shell 测试入口：

```bash
./scripts/run_tests.sh -t fvsh_script -T 30
```

重新检查已有日志：

```bash
python3 ./scripts/run_tests.py --check logs/
```

## 调试构建

如果需要让 QEMU 停住等待 GDB：

```bash
make debug BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

另开一个终端连接：

```bash
make gdb
```

`make debug` 会使用 `BUILD=debug` 重新构建内核，并给 QEMU 加上 `-s -S`。

## 常见问题

### QEMU 没有退出

如果上一次 QEMU 没有正常退出，可以先清理旧进程：

```bash
pkill -f qemu-system-riscv
```

### 切换 ROOTFS 后行为异常

切换 Easy-FS / EXT4 后，建议先清理再运行：

```bash
make clean
make qemu BOOT=opensbi ROOTFS=easyfs FS_LIST="easyfs devtmpfs" TEST=fvsh
```

### 找不到测试文件

`TEST=<name>` 必须对应项目里的测试文件。选择规则是取 `test_` 后面的名字：

```text
test/test_<name>.c
```

例如：

```text
TEST=sys_pipe -> test/test_sys_pipe.c
```
