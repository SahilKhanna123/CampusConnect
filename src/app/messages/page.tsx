// Messages — conversation list, scoped to (trip, counterpart) pairs.
// TODO: fetch Conversations the current user participates in; poll for new
// Messages while a thread is open (see plan doc §14 — polling, not websockets).

export default function MessagesPage() {
  return (
    <div>
      <h1>Messages</h1>
      <p>Your conversations will appear here.</p>
    </div>
  );
}
