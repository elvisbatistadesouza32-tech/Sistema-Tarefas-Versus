import React from 'react';
import { Trash2, MoreHorizontal, Plus, X, Calendar, Repeat } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { List, Card } from '../types';
import { CardItem } from './CardItem';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BoardListProps {
  list: List;
  cards: Card[];
  editingListId: string | null;
  editingListName: string;
  setEditingListName: (name: string) => void;
  setEditingListId: (id: string | null) => void;
  renameList: (id: string, name: string) => void;
  setListToDeleteId: (id: string | null) => void;
  setListMenuPos: (pos: { top: number, left: number } | null) => void;
  setListMenuId: (id: string | null) => void;
  addingCardToList: string | null;
  setAddingCardToList: (id: string | null) => void;
  newCardTitle: string;
  setNewCardTitle: (title: string) => void;
  newCardUrgency: 'low' | 'medium' | 'high';
  setNewCardUrgency: (urgency: 'low' | 'medium' | 'high') => void;
  newCardIsRecurrent: boolean;
  setNewCardIsRecurrent: (isRecurrent: boolean) => void;
  newCardDueDate: string;
  setNewCardDueDate: (date: string) => void;
  addCard: (listId: string, title: string, urgency: 'low' | 'medium' | 'high', isRecurrent: boolean, dueDate?: string) => void;
  onCardClick: (cardId: string) => void;
  onCardDelete: (cardId: string) => void;
}

export const BoardList = React.memo(({
  list,
  cards,
  editingListId,
  editingListName,
  setEditingListName,
  setEditingListId,
  renameList,
  setListToDeleteId,
  setListMenuPos,
  setListMenuId,
  addingCardToList,
  setAddingCardToList,
  newCardTitle,
  setNewCardTitle,
  newCardUrgency,
  setNewCardUrgency,
  newCardIsRecurrent,
  setNewCardIsRecurrent,
  newCardDueDate,
  setNewCardDueDate,
  addCard,
  onCardClick,
  onCardDelete
}: BoardListProps) => {
  return (
    <div
      className="w-[85vw] sm:w-80 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md rounded-[2rem] flex flex-col max-h-full shrink-0 shadow-xl border border-white/20 dark:border-slate-800/50 transition-all duration-300 snap-center"
    >
      <div className="p-5 flex items-center justify-between group relative z-10">
        {editingListId === list.id ? (
          <div className="flex-1 flex items-center gap-2 px-2">
            <input
              autoFocus
              type="text"
              value={editingListName}
              onChange={(e) => setEditingListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameList(list.id, editingListName);
                if (e.key === 'Escape') setEditingListId(null);
              }}
              onBlur={() => renameList(list.id, editingListName)}
              className="flex-1 bg-white dark:bg-slate-800 border-none rounded-md p-1 text-sm font-bold outline-none ring-2 ring-blue-500"
            />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setListToDeleteId(list.id);
                setEditingListId(null);
              }}
              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Excluir Lista"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            <h3 
              onClick={() => {
                setEditingListId(list.id);
                setEditingListName(list.name);
              }}
              className="font-bold text-slate-700 dark:text-slate-200 text-sm px-2 flex items-center gap-2 cursor-pointer hover:text-versus transition-colors flex-1"
            >
              {list.name}
              <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-500 font-medium">
                {cards.length}
              </span>
            </h3>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                let left = rect.left;
                let top = rect.top + rect.height;
                
                if (left + 192 > window.innerWidth) {
                  left = window.innerWidth - 192 - 16;
                }
                
                if (top + 120 > window.innerHeight) {
                  top = rect.top - 120 - 8;
                }

                setListMenuPos({ top: top, left: left });
                setListMenuId(list.id);
              }}
              className="p-3 -mr-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Opções da Lista"
            >
              <MoreHorizontal className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar min-h-[50px]">
        {cards.map((card) => (
          <CardItem 
            key={card.id} 
            card={card} 
            onClick={onCardClick} 
            onDelete={onCardDelete} 
          />
        ))}
      </div>

      <div className="p-3">
        {addingCardToList === list.id ? (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <input
              autoFocus
              type="text"
              placeholder="Título da tarefa..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCardTitle) {
                  addCard(list.id, newCardTitle, newCardUrgency, newCardIsRecurrent, newCardDueDate);
                } else if (e.key === 'Escape') {
                  setAddingCardToList(null);
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-versus/50"
            />
            
            <div className="flex items-center gap-2 px-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date"
                value={newCardDueDate}
                onChange={(e) => setNewCardDueDate(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none border-none text-slate-500 dark:text-slate-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setNewCardUrgency('low')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    newCardUrgency === 'low' ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Baixa
                </button>
                <button
                  onClick={() => setNewCardUrgency('medium')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    newCardUrgency === 'medium' ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Média
                </button>
                <button
                  onClick={() => setNewCardUrgency('high')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    newCardUrgency === 'high' ? "bg-rose-100 text-rose-700" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Alta
                </button>
              </div>

              <button
                onClick={() => setNewCardIsRecurrent(!newCardIsRecurrent)}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider",
                  newCardIsRecurrent ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:text-slate-600"
                )}
                title="Tarefa Recorrente"
              >
                <Repeat className="w-4 h-4" />
                {newCardIsRecurrent && <span>Recorrente</span>}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  if (newCardTitle) addCard(list.id, newCardTitle, newCardUrgency, newCardIsRecurrent, newCardDueDate);
                }}
                className="flex-1 bg-versus text-white py-3 rounded-xl text-sm font-black shadow-xl shadow-versus/20 active:scale-95 transition-all"
              >
                Adicionar
              </button>
              <button
                onClick={() => setAddingCardToList(null)}
                className="p-3 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setAddingCardToList(list.id)}
            className="w-full flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 p-4 rounded-2xl text-sm font-bold transition-all border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500"
          >
            <Plus className="w-5 h-5" />
            Adicionar um cartão
          </button>
        )}
      </div>
    </div>
  );
});

BoardList.displayName = 'BoardList';
