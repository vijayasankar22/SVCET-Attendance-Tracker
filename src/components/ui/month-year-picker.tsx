
'use client';

import * as React from 'react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

type MonthYear = {
  year: number;
  month: number;
};

type MonthYearPickerProps = {
  date: MonthYear;
  onDateChange: (date: MonthYear) => void;
};

export function MonthYearPicker({ date, onDateChange }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(date.year);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const handleMonthClick = (monthIndex: number) => {
    onDateChange({ year: viewYear, month: monthIndex + 1 });
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-[180px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(new Date(date.year, date.month - 1), 'MMM yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 month-picker-popover" align="start">
        <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setViewYear(v => v - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-semibold text-sm">{viewYear}</div>
                 <Button variant="ghost" size="icon" onClick={() => setViewYear(v => v + 1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => (
                    <Button
                        key={month}
                        variant={date.year === viewYear && date.month === index + 1 ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleMonthClick(index)}
                    >
                        {month}
                    </Button>
                ))}
            </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
