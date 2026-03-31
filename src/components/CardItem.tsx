import React from 'react';
import { Trash2, ArrowRightLeft, Repeat, Zap, CheckSquare, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Card } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardItemProps {
  card: Card;
  onClick: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}

export const CardItem = React.memo(({ card, onClick, onDelete }: CardItemProps) => {
  return (
    <div
      onClick={() => onClick(card.id)}
      className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm mb-3 border border-slate-200 dark:border-slate-700 hover:border-blue-500 group select-none relative hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]"
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {card.labels.map(label => (
            <div key={label.id} className={cn("h-2 w-10 rounded-full", label.color)}></div>
          ))}
        </div>
      )}
      {card.urgency && card.urgency !== 'low' && (
        <div className={cn(
          "h-1.5 w-14 rounded-full mb-2.5",
          card.urgency === 'high' ? "bg-rose-500" : "bg-amber-500"
        )}></div>
      )}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-bold text-slate-900 dark:text-white pr-8 leading-tight">{card.title}</h4>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all md:block hidden"
            title="Excluir tarefa"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          {/* Mobile Delete Icon - Always visible on small screens */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500 md:hidden block"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <div
            className="p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-400 group-hover:text-blue-500 transition-colors"
            title="Mover tarefa"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        </div>
      </div>
      
      <div className="flex items-center flex-wrap gap-3 text-slate-400">
        {card.isRecurrent && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
            <Repeat className="w-3.5 h-3.5" />
            <span>Recorrente</span>
          </div>
        )}
        {card.urgency === 'high' && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
            <Zap className="w-3.5 h-3.5 fill-rose-500" />
            <span>Urgente</span>
          </div>
        )}
        {card.checklist.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            <CheckSquare className="w-3.5 h-3.5" />
            {card.checklist.filter(i => i.completed).length}/{card.checklist.length}
          </div>
        )}
        {card.dueDate && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full ml-auto">
            <Clock className="w-3.5 h-3.5" />
            {card.dueDate.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
});

CardItem.displayName = 'CardItem';
