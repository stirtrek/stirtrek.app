export const metadata = {
  title: "Polls",
};

export default function PollsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Polls</h1>
      <p className="text-muted-foreground">
        Active polls will appear here.
      </p>
    </div>
  );
}
