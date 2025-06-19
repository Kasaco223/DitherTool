import React, { useState, useRef, useEffect } from "react";

function CustomSelect({ options, value, onChange, placeholder = "Selecciona...", className = "", disabled = false, onDeleteOption }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);

  // Cerrar el menú al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navegación con teclado
  function handleKeyDown(e) {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      setOpen(true);
      setHighlighted(0);
      e.preventDefault();
    } else if (open) {
      if (e.key === "ArrowDown") {
        setHighlighted((h) => (h + 1) % options.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHighlighted((h) => (h - 1 + options.length) % options.length);
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === " ") {
        if (highlighted >= 0) {
          onChange(options[highlighted].value);
          setOpen(false);
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setOpen(false);
        e.preventDefault();
      }
    }
  }

  // Selección con click
  function handleSelect(val) {
    if (disabled) return;
    onChange(val);
    setOpen(false);
  }

  // Encontrar label del valor seleccionado
  const selected = options.find((opt) => opt.value === value);

  return (
    <div
      ref={ref}
      tabIndex={disabled ? -1 : 0}
      className={`relative select-none border border-black bg-white rounded-none px-3 py-2 flex items-center min-w-[180px] ${className} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      role="listbox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-disabled={disabled}
      aria-activedescendant={open && highlighted >= 0 ? `custom-select-opt-${highlighted}` : undefined}
      onClick={() => { if (!disabled) setOpen((o) => !o); }}
      onKeyDown={handleKeyDown}
    >
      <span className="flex-1 text-left truncate">
        {selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}
      </span>
      {/* Flecha SVG */}
      <svg
        className={`ml-2 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ pointerEvents: "none", position: "absolute", right: 12 }}
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
      {/* Opciones */}
      {open && !disabled && (
        <ul
          className="overflow-auto absolute left-0 top-full z-10 mt-1 w-full max-h-60 bg-white rounded-none border border-black shadow-lg"
          role="listbox"
        >
          {options.map((opt, i) => (
            <li
              id={`custom-select-opt-${i}`}
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`px-3 py-2 cursor-pointer flex items-center justify-between ${i === highlighted ? "bg-black text-white" : ""} ${value === opt.value ? "font-bold" : ""}`}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
            >
              <span>{opt.label}</span>
              {onDeleteOption && opt.deletable && (
                <button
                  className="ml-2 text-xs text-red-600 hover:underline"
                  onClick={e => { e.stopPropagation(); onDeleteOption(opt.value); }}
                  tabIndex={-1}
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect; 