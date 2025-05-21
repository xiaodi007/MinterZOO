import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化数字输入字符串：
 * - 去除整数部分前导0
 * - 保留小数点、小数位
 * - 保留负号
 */
export function formatNumericInput(value: string): string {
  if (!value) return '';

  // 如果是类似 ".5" 开头的，自动补全为 "0.5"
  if (/^-?\.\d+$/.test(value)) {
    return value.replace('.', '0.');
  }

  // 拆分整数与小数部分
  const match = value.match(/^(-?)(0*)(\d*)(\.?\d*)$/);

  if (!match) return value; // fallback 原值

  const [, sign, leadingZeros, intPart, decimalPart] = match;

  // 保证至少有1位整数数字（如果没有就补0）
  const cleanedInt = intPart || '0';

  return `${sign}${parseInt(cleanedInt, 10)}${decimalPart}`;
}
