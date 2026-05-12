export const metadata = { title: "页面不存在" };

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="mt-3 text-sm opacity-80">请从首页进入，或使用 /?events/1 这类查询路由地址。</p>
    </main>
  );
}
