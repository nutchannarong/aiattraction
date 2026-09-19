"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  group?: string;
};

type Props = {
  name: string;
  placeholder: string;
  options: SearchableOption[];
  value?: string;
};

export function SearchableSelect({ name, placeholder, options, value = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  // -1 represents the empty/default option, such as "ทุกจังหวัด".
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = options.find((option) => option.value === selectedValue);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      `${option.label} ${option.group ?? ""}`
        .toLocaleLowerCase("th-TH")
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const displayValue = isOpen ? query : selected?.label ?? "";
  const selectOption = (option: SearchableOption) => {
    setQuery("");
    setSelectedValue(option.value);
    setActiveIndex(0);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selectedValue} readOnly />
      <input
        value={displayValue}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${name}-options`}
        aria-activedescendant={
          isOpen
            ? activeIndex < 0
              ? `${name}-option-empty`
              : `${name}-option-${activeIndex}`
            : undefined
        }
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        onFocus={() => {
          setQuery("");
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(event.target.value ? 0 : -1);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && filteredOptions.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
            return;
          }
          if (event.key === "ArrowUp" && filteredOptions.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, -1));
            return;
          }
          if (event.key === "Enter" && activeIndex < 0) {
            event.preventDefault();
            setQuery("");
            setSelectedValue("");
            setIsOpen(false);
            return;
          }
          if (event.key === "Enter" && filteredOptions[activeIndex]) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex]);
            return;
          }
          if (event.key === "Escape") {
            setQuery("");
            setIsOpen(false);
          }
        }}
      />

      {isOpen && (
        <div
          id={`${name}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            id={`${name}-option-empty`}
            aria-selected={!selectedValue}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-background ${
              activeIndex < 0 ? "bg-background" : ""
            }`}
            onClick={() => {
              setQuery("");
              setSelectedValue("");
              setActiveIndex(-1);
              setIsOpen(false);
            }}
          >
            {placeholder}
          </button>

          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">ไม่พบรายการที่เกี่ยวข้อง</p>
          ) : (
            filteredOptions.map((option, index) => {
              const previous = filteredOptions[index - 1];
              const showGroup = option.group && option.group !== previous?.group;

              return (
                <div key={option.value}>
                  {showGroup && (
                    <p className="border-t border-border px-3 py-1 text-xs text-muted first:border-0">
                      {option.group}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    id={`${name}-option-${index}`}
                    aria-selected={option.value === selectedValue}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-background ${
                      index === activeIndex ? "bg-background" : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    {option.label}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
