import React, { useState, useMemo } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Card } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CalendarViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onDayClick: (date: Date) => void;
}

export const CalendarView = ({ cards, onCardClick, onDayClick }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  // Previous month days
  const prevMonthDays = daysInMonth(year, month - 1);
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }
  
  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
  }
  
  // Next month days
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
  }

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  // Optimization: Group cards by date string for O(1) lookup during render
  const groupedCards = useMemo(() => {
    const groups: Record<string, Card[]> = {};
    cards.forEach(card => {
      if (card.dueDate) {
        const dateStr = card.dueDate.toDate().toDateString();
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(card);
      }
    });
    return groups;
  }, [cards]);

  return (
    <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800/50 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {monthNames[month]} <span className="text-slate-400 font-medium">{year}</span>
          </h2>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 rotate-180" />
            </button>
          </div>
        </div>
        <button 
          onClick={() => setCurrentDate(new Date())}
          className="px-4 py-2 bg-versus text-white text-sm font-bold rounded-xl hover:bg-versus/90 transition-all active:scale-95"
        >
          Hoje
        </button>
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="min-w-[800px] h-full grid grid-cols-7 grid-rows-6">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
          <div key={day} className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
            {day}
          </div>
        ))}
        {days.map((d, i) => {
          const dayCards = groupedCards[d.date.toDateString()] || [];
          const isToday = new Date().toDateString() === d.date.toDateString();
          
          return (
            <div 
              key={i} 
              onClick={() => onDayClick(d.date)}
              className={cn(
                "p-2 border-r border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group/day",
                !d.currentMonth && "bg-slate-50/50 dark:bg-slate-950/20 opacity-40",
                i % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-versus text-white shadow-lg shadow-versus/30" : "text-slate-500 dark:text-slate-400"
                )}>
                  {d.day}
                </span>
                <Plus className="w-3 h-3 text-slate-300 opacity-0 group-hover/day:opacity-100 transition-opacity" />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                {dayCards.map(card => (
                  <div 
                    key={card.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCardClick(card);
                    }}
                    className={cn(
                      "text-[10px] p-1.5 rounded-lg border shadow-sm cursor-pointer transition-all hover:scale-105",
                      card.urgency === 'high' ? "bg-rose-50 border-rose-100 text-rose-700" :
                      card.urgency === 'medium' ? "bg-amber-50 border-amber-100 text-amber-700" :
                      "bg-blue-50 border-blue-100 text-blue-700"
                    )}
                  >
                    <div className="font-bold truncate">{card.title}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};
