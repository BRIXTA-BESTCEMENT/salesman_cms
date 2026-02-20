// app/api/chatbot/chatHistory/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // In a real application, you would replace this mock data with a database query.
    // For example, using Prisma:
    // const chatSessions = await prisma.chatSession.findMany({
    //   where: { userId: req.user.id },
    //   orderBy: { updatedAt: 'desc' },
    // });
    // You would only fetch the session data, not the messages themselves.

    const mockChatSessions = [
        {
            id: '1',
            title: 'Company Analytics Discussion',
            lastMessage: 'Can you analyze our Q4 performance?',
            timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
            messageCount: 12
        },
        {
            id: '2',
            title: 'Employee Onboarding Process',
            lastMessage: 'How to streamline new hire workflows?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            messageCount: 8
        },
        {
            id: '3',
            title: 'Budget Planning Help',
            lastMessage: 'Help me create next year\'s budget',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            messageCount: 15
        },
    ];

    // Send the session data back to the frontend to populate the sidebar.
    return NextResponse.json(mockChatSessions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred while fetching chat history.' }, 
        { status: 500 });
  }
}
