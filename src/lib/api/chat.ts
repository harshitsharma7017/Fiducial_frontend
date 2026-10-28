import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  CHAT_FILE_TYPES,
  CHAT_PAGE_SIZE,
  ChatAttachmentSchema,
  ChatDirectorySchema,
  ChatMessageSchema,
  ConversationListSchema,
  ConversationSchema,
  MessagePageSchema,
  isChatFileType,
  type ChatMessage,
  type Conversation,
  type CreateGroupRequest,
  type MessagePage,
} from '@/shared';

// The internal chat's data. Every list is kept fresh by the live connection (chat-live.tsx),
// which writes new messages into these caches and refreshes the conversations; nothing polls.

export type MessagePages = InfiniteData<MessagePage, string | null>;

export function useChatDirectory(enabled = true) {
  return useQuery({
    queryKey: queryKeys.chat.directory,
    queryFn: ({ signal }) => apiFetch('chat/directory', { schema: ChatDirectorySchema, signal }),
    enabled,
    staleTime: 60_000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.chat.conversations,
    queryFn: ({ signal }) =>
      apiFetch('chat/conversations', { schema: ConversationListSchema, signal }),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.conversation(id ?? ''),
    queryFn: ({ signal }) =>
      apiFetch(`chat/conversations/${id}`, { schema: ConversationSchema, signal }),
    enabled: id !== null,
  });
}

/** A conversation's messages, newest page first (older pages are loaded on request). */
export function useMessages(id: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.chat.messages(id ?? ''),
    queryFn: ({ pageParam, signal }) =>
      apiFetch(
        `chat/conversations/${id}/messages?limit=${CHAT_PAGE_SIZE}${pageParam ? `&before=${pageParam}` : ''}`,
        { schema: MessagePageSchema, signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? (page.items[0]?.id ?? null) : null),
    enabled: id !== null,
  });
}

/** All loaded messages of a conversation, oldest first. */
export function messagesOf(data: { pages: readonly MessagePage[] } | undefined): ChatMessage[] {
  return (data?.pages ?? []).toReversed().flatMap((page) => page.items);
}

/**
 * Puts a message into the loaded pages: a known one is replaced (a deletion), a new one goes at
 * the end of the newest page. Nothing loads when the conversation has not been opened.
 */
export function upsertMessage(client: QueryClient, message: ChatMessage): void {
  client.setQueryData<MessagePages>(queryKeys.chat.messages(message.conversationId), (data) => {
    if (!data) return data;
    const known = data.pages.some((page) => page.items.some((item) => item.id === message.id));
    if (known) {
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === message.id ? message : item)),
        })),
      };
    }
    const [newest, ...rest] = data.pages;
    if (!newest) return data;
    return { ...data, pages: [{ ...newest, items: [...newest.items, message] }, ...rest] };
  });
}

/** The type a file is uploaded as: its own when the chat takes it, else by its extension. */
export function chatFileType(file: File): string | null {
  if (isChatFileType(file.type)) return file.type;
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  const known = Object.entries(CHAT_FILE_TYPES).find(([, value]) => value === extension);
  if (known) return known[0];
  if (extension === '.jpeg') return 'image/jpeg';
  return null;
}

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; file: File | null; clientId: string }) => {
      let attachmentId: string | null = null;
      if (input.file) {
        const type = chatFileType(input.file);
        if (!type) throw new Error('This kind of file cannot be shared in the chat');
        const uploaded = await apiFetch(
          `chat/conversations/${conversationId}/files?fileName=${encodeURIComponent(input.file.name)}`,
          {
            method: 'POST',
            body: new Blob([input.file], { type }),
            schema: ChatAttachmentSchema,
          },
        );
        attachmentId = uploaded.id;
      }
      return apiFetch(`chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { text: input.text, attachmentId, clientId: input.clientId },
        schema: ChatMessageSchema,
      });
    },
    onSuccess: (message) => {
      upsertMessage(client, message);
      void client.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch(`chat/conversations/${conversationId}/messages/${messageId}`, {
        method: 'DELETE',
        schema: ChatMessageSchema,
      }),
    onSuccess: (message) => upsertMessage(client, message),
  });
}

/** Marks a conversation read: its unread count and the navbar's go down at once. */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch(`chat/conversations/${conversationId}/read`, { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.chat.conversations }),
  });
}

function useConversationMutation<T>(run: (input: T) => Promise<Conversation>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (conversation) => {
      client.setQueryData(queryKeys.chat.conversation(conversation.id), conversation);
      void client.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    },
  });
}

export const useOpenDirectChat = () =>
  useConversationMutation((userId: string) =>
    apiFetch('chat/conversations/direct', {
      method: 'POST',
      body: { userId },
      schema: ConversationSchema,
    }),
  );

export const useCreateGroup = () =>
  useConversationMutation((input: CreateGroupRequest) =>
    apiFetch('chat/conversations/groups', {
      method: 'POST',
      body: input,
      schema: ConversationSchema,
    }),
  );

export const useRenameGroup = (conversationId: string) =>
  useConversationMutation((name: string) =>
    apiFetch(`chat/conversations/${conversationId}/name`, {
      method: 'PUT',
      body: { name },
      schema: ConversationSchema,
    }),
  );

export const useAddMembers = (conversationId: string) =>
  useConversationMutation((userIds: string[]) =>
    apiFetch(`chat/conversations/${conversationId}/members`, {
      method: 'POST',
      body: { userIds },
      schema: ConversationSchema,
    }),
  );

export const useRemoveMember = (conversationId: string) =>
  useConversationMutation((userId: string) =>
    apiFetch(`chat/conversations/${conversationId}/members/${userId}`, {
      method: 'DELETE',
      schema: ConversationSchema,
    }),
  );

/** Leaves a group: it disappears from the list. */
export function useLeaveGroup(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`chat/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: queryKeys.chat.conversation(conversationId) });
      client.removeQueries({ queryKey: queryKeys.chat.messages(conversationId) });
      void client.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    },
  });
}
