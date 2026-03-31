#!/usr/bin/env bun

import { input, password, confirm } from '@inquirer/prompts';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { adminUsers } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

async function main() {
  console.log('🚀 创建管理员账号\n');

  try {
    // 交互式输入
    const username = await input({
      message: '请输入用户名:',
      default: 'admin',
      validate: (value) => {
        if (!value.trim()) return '用户名不能为空';
        if (value.length < 3) return '用户名至少需要 3 个字符';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return '用户名只能包含字母、数字、下划线和横线';
        }
        return true;
      },
    });

    const displayName = await input({
      message: '请输入显示名称:',
      default: '管理员',
      validate: (value) => {
        if (!value.trim()) return '显示名称不能为空';
        return true;
      },
    });

    const plainPassword = await password({
      message: '请输入密码:',
      mask: '*',
      validate: (value) => {
        if (value.length < 6) return '密码至少需要 6 个字符';
        return true;
      },
    });

    const confirmPassword = await password({
      message: '请再次输入密码确认:',
      mask: '*',
    });

    if (plainPassword !== confirmPassword) {
      console.error('❌ 两次输入的密码不一致');
      process.exit(1);
    }

    const role = await input({
      message: '请选择角色 (admin/teacher):',
      default: 'admin',
      validate: (value) => {
        if (!['admin', 'teacher'].includes(value)) {
          return '角色必须是 admin 或 teacher';
        }
        return true;
      },
    }) as 'admin' | 'teacher';

    // 检查用户名是否已存在
    const existing = await db
      .select({ id: adminUsers.id, username: adminUsers.username })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .get();

    if (existing) {
      const overwrite = await confirm({
        message: `用户名 "${username}" 已存在，是否覆盖更新？`,
        default: false,
      });

      if (!overwrite) {
        console.log('❌ 操作已取消');
        process.exit(0);
      }

      // 更新现有管理员
      await db
        .update(adminUsers)
        .set({
          passwordHash: hashPassword(plainPassword),
          displayName: displayName.trim(),
          role,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.username, username));

      console.log(`\n✅ 管理员 "${username}" 已更新`);
    } else {
      // 创建新管理员
      await db.insert(adminUsers).values({
        username: username.trim(),
        passwordHash: hashPassword(plainPassword),
        displayName: displayName.trim(),
        role,
        status: 'active',
      });

      console.log(`\n✅ 管理员 "${username}" 创建成功`);
    }

    console.log('\n管理员信息:');
    console.log(`  用户名: ${username}`);
    console.log(`  显示名: ${displayName}`);
    console.log(`  角色: ${role}`);

  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log('\n❌ 操作已取消');
      process.exit(0);
    }
    console.error('\n❌ 创建失败:', error);
    process.exit(1);
  }
}

main();
