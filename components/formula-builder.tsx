"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Delete, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormulaBuilderProps {
  value: string
  onChange: (value: string) => void
  label?: string
  builtinVariables: { name: string; label?: string }[]
  customVariables?: { name: string; label?: string }[]
  disabled?: boolean
}

// Token types for syntax highlighting
type TokenType = "variable" | "operator" | "number" | "function" | "paren" | "comma" | "text"

interface Token {
  text: string
  type: TokenType
}

const OPERATORS = [
  { symbol: "+", label: "+" },
  { symbol: "-", label: "−" },
  { symbol: "*", label: "×" },
  { symbol: "/", label: "÷" },
  { symbol: "**", label: "^" },
]

const PARENS = [
  { symbol: "(", label: "(" },
  { symbol: ")", label: ")" },
]

const FUNCTIONS = [
  { name: "max", label: "Максимум()", desc: "Выбирает большее из значений" },
  { name: "min", label: "Минимум()", desc: "Выбирает меньшее из значений" },
  { name: "round", label: "Округлить()", desc: "Округление до целого числа" },
  { name: "abs", label: "Модуль()", desc: "Убирает минус у числа" },
  { name: "ceil", label: "Округл.вверх()", desc: "Округление вверх до целого" },
  { name: "floor", label: "Округл.вниз()", desc: "Округление вниз до целого" },
]

function tokenize(formula: string, allVarNames: Set<string>): Token[] {
  if (!formula) return []

  const tokens: Token[] = []
  let remaining = formula

  while (remaining.length > 0) {
    remaining = remaining.trimStart()
    if (!remaining) break

    // Check for function names
    let matched = false
    for (const fn of FUNCTIONS) {
      if (remaining.startsWith(fn.name + "(") || remaining.startsWith(fn.name + " ")) {
        tokens.push({ text: fn.name, type: "function" })
        remaining = remaining.slice(fn.name.length)
        matched = true
        break
      }
    }
    if (matched) continue

    // Check for variable names (longest match first)
    const sortedVars = Array.from(allVarNames).sort((a, b) => b.length - a.length)
    for (const varName of sortedVars) {
      if (remaining.startsWith(varName)) {
        const nextChar = remaining[varName.length]
        if (!nextChar || /[^а-яА-Яa-zA-Z0-9_]/.test(nextChar)) {
          tokens.push({ text: varName, type: "variable" })
          remaining = remaining.slice(varName.length)
          matched = true
          break
        }
      }
    }
    if (matched) continue

    // Check for numbers (including decimals)
    const numMatch = remaining.match(/^[\d]+\.?[\d]*/)
    if (numMatch) {
      tokens.push({ text: numMatch[0], type: "number" })
      remaining = remaining.slice(numMatch[0].length)
      continue
    }

    // Check for operators
    if (remaining.startsWith("**")) {
      tokens.push({ text: "**", type: "operator" })
      remaining = remaining.slice(2)
      continue
    }

    const char = remaining[0]
    if ("+-*/".includes(char)) {
      tokens.push({ text: char, type: "operator" })
      remaining = remaining.slice(1)
      continue
    }

    if ("()".includes(char)) {
      tokens.push({ text: char, type: "paren" })
      remaining = remaining.slice(1)
      continue
    }

    if (char === ",") {
      tokens.push({ text: ",", type: "comma" })
      remaining = remaining.slice(1)
      continue
    }

    // Unknown character
    tokens.push({ text: char, type: "text" })
    remaining = remaining.slice(1)
  }

  return tokens
}

const tokenColors: Record<TokenType, string> = {
  variable: "bg-blue-100 text-blue-800 border-blue-200",
  operator: "bg-gray-100 text-gray-800 border-gray-300 font-bold",
  number: "bg-amber-50 text-amber-800 border-amber-200",
  function: "bg-purple-100 text-purple-800 border-purple-200",
  paren: "bg-gray-50 text-gray-600 border-gray-200 font-bold text-lg",
  comma: "bg-gray-50 text-gray-600 border-gray-200",
  text: "bg-gray-50 text-gray-500 border-gray-200",
}

export function FormulaBuilder({
  value,
  onChange,
  label,
  builtinVariables,
  customVariables = [],
  disabled = false,
}: FormulaBuilderProps) {
  const [numberInput, setNumberInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const allVarNames = new Set([
    ...builtinVariables.map((v) => v.name),
    ...customVariables.map((v) => v.name),
  ])

  const tokens = tokenize(value, allVarNames)

  const appendToFormula = (text: string) => {
    if (disabled) return
    const needsSpace = value && !value.endsWith(" ") && !value.endsWith("(") && text !== ")" && text !== ","
    const prefix = needsSpace ? " " : ""
    onChange(value + prefix + text)
  }

  const insertFunction = (name: string) => {
    if (disabled) return
    const needsSpace = value && !value.endsWith(" ") && !value.endsWith("(")
    const prefix = needsSpace ? " " : ""
    onChange(value + prefix + name + "(")
  }

  const insertNumber = () => {
    if (!numberInput || disabled) return
    appendToFormula(numberInput)
    setNumberInput("")
    inputRef.current?.focus()
  }

  const handleBackspace = () => {
    if (disabled || !value) return
    const trimmed = value.trimEnd()
    // Try to remove last token
    const lastTokens = tokenize(trimmed, allVarNames)
    if (lastTokens.length === 0) {
      onChange("")
      return
    }
    const lastToken = lastTokens[lastTokens.length - 1]
    // Remove the last token + any trailing whitespace before it
    const withoutLast = trimmed.slice(0, trimmed.length - lastToken.text.length).trimEnd()
    onChange(withoutLast)
  }

  const handleClear = () => {
    if (disabled) return
    onChange("")
  }

  const handleNumberKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      insertNumber()
    }
  }

  return (
    <div className="space-y-3">
      {label && (
        <div className="text-sm font-medium text-gray-700">{label}</div>
      )}

      {/* Formula display */}
      <div className="min-h-[52px] p-3 border rounded-lg bg-white flex flex-wrap items-center gap-1.5">
        {tokens.length > 0 ? (
          tokens.map((token, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded border text-sm font-mono",
                tokenColors[token.type]
              )}
            >
              {token.type === "operator" && token.text === "*" ? "×" :
               token.type === "operator" && token.text === "/" ? "÷" :
               token.type === "operator" && token.text === "**" ? "^" :
               token.text}
            </span>
          ))
        ) : (
          <span className="text-gray-400 text-sm">Нажмите на элементы ниже чтобы собрать формулу...</span>
        )}
      </div>

      {/* Raw formula (editable) */}
      <details className="text-xs">
        <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
          Текстовый вид формулы
        </summary>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 font-mono text-xs"
          disabled={disabled}
          placeholder="Или введите формулу вручную"
        />
      </details>

      {/* Controls */}
      <div className="space-y-2">
        {/* Builtin Variables */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Переменные товара</div>
          <div className="flex flex-wrap gap-1.5">
            {builtinVariables.map((v) => (
              <Button
                key={v.name}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                onClick={() => appendToFormula(v.name)}
                disabled={disabled}
              >
                {v.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Variables */}
        {customVariables.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Пользовательские переменные</div>
            <div className="flex flex-wrap gap-1.5">
              {customVariables.map((v) => (
                <Button
                  key={v.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                  onClick={() => appendToFormula(v.name)}
                  disabled={disabled}
                >
                  {v.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Operators, Parens, Functions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Operators */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Операторы</div>
            <div className="flex gap-1">
              {OPERATORS.map((op) => (
                <Button
                  key={op.symbol}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-8 h-8 p-0 font-bold text-base"
                  onClick={() => appendToFormula(op.symbol)}
                  disabled={disabled}
                >
                  {op.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Parens */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Скобки</div>
            <div className="flex gap-1">
              {PARENS.map((p) => (
                <Button
                  key={p.symbol}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-8 h-8 p-0 font-bold text-base"
                  onClick={() => appendToFormula(p.symbol)}
                  disabled={disabled}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-8 h-8 p-0 text-gray-500"
                onClick={() => appendToFormula(",")}
                disabled={disabled}
                title="Запятая (разделитель аргументов)"
              >
                ,
              </Button>
            </div>
          </div>

          {/* Functions */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Функции</div>
            <div className="flex flex-wrap gap-1">
              {FUNCTIONS.map((fn) => (
                <Button
                  key={fn.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
                  onClick={() => insertFunction(fn.name)}
                  disabled={disabled}
                  title={fn.desc}
                >
                  {fn.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Number input */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Число</div>
            <div className="flex gap-1">
              <Input
                ref={inputRef}
                type="text"
                value={numberInput}
                onChange={(e) => {
                  const val = e.target.value.replace(",", ".")
                  if (val === "" || /^[\d]*\.?[\d]*$/.test(val)) {
                    setNumberInput(val)
                  }
                }}
                onKeyDown={handleNumberKeyDown}
                placeholder="0"
                className="w-[80px] h-8 text-sm"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={insertNumber}
                disabled={disabled || !numberInput}
              >
                Вставить
              </Button>
            </div>
          </div>
        </div>

        {/* Backspace / Clear */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBackspace}
            disabled={disabled || !value}
            className="text-xs"
          >
            <Delete className="h-3 w-3 mr-1" />
            Удалить последнее
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled || !value}
            className="text-xs text-red-500 hover:text-red-700"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Очистить
          </Button>
        </div>
      </div>
    </div>
  )
}
