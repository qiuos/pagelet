// 动画配置
export const animations = {
  // 页面过渡
  pageVariants: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  pageTransition: {
    duration: 0.3
  },

  // 卡片悬停
  cardVariants: {
    hover: {
      scale: 1.02,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
    },
    tap: { scale: 0.98 }
  },

  // 列表交错动画
  listVariants: {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  },

  // 淡入
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  }
};

// 工具函数
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}