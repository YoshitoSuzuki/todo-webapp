// サーバーとブラウザの両方で使う型。型だけなので実行時には消える
export type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export const TITLE_MAX = 100;
