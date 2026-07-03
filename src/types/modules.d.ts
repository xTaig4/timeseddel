// drizzle-kit genererer migrations.js uden typedeklarationer
declare module '*drizzle/migrations' {
  const value: {
    journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] };
    migrations: Record<string, string>;
  };
  export default value;
}
