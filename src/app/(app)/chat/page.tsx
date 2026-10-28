import type { Metadata } from 'next';
import { ChatView } from './chat-view';

export const metadata: Metadata = { title: 'Chat' };

/** The internal chat; ?c=<conversation id> opens a conversation. Open to every signed-in user. */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { c } = await searchParams;
  return <ChatView initialId={typeof c === 'string' && /^[a-f0-9]{24}$/i.test(c) ? c : null} />;
}
