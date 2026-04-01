import { Timestamp } from 'firebase/firestore';

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  background: string;
  createdAt: Timestamp;
}

export interface List {
  id: string;
  boardId: string;
  name: string;
  order: number;
}

export interface Label {
  id: string;
  text: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Card {
  id: string;
  listId: string;
  boardId: string;
  title: string;
  description: string;
  order: number;
  dueDate?: Timestamp;
  labels: Label[];
  members: string[];
  checklist: ChecklistItem[];
  createdAt: Timestamp;
  isRecurrent?: boolean;
  lastResetAt?: Timestamp;
  urgency?: 'low' | 'medium' | 'high';
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
  role: 'admin' | 'user';
}
