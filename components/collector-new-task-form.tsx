"use client"

import { useEffect, useState, useMemo } from "react"
import {
  createCollectorTask,
  listCatalogCities,
  getColumnsAvailable,
  type CityCatalogItem,
  type ColumnsAvailable,
} from "@/app/actions/collector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, MapPin, Search, Link2, Sliders, Play, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  onCreated: () => void
  /**
   * Owner-only: показывать «Максимум записей с одного URL» и «Пауза между
   * кликами». Обычному админу эти параметры не нужны и путают —
   * скрываем за отдельной owner-only кнопкой «Настройки» на странице.
   */
  showAdvancedSettings?: boolean
}

export default function CollectorNewTaskForm({ onCreated, showAdvancedSettings = false }: Props) {
  const { toast } = useToast()

  // Название задачи — обязательное
  const [name, setName] = useState("")

  // Режим ввода: cities+queries ИЛИ custom_url
  const [mode, setMode] = useState<"catalog" | "url">("catalog")

  // Каталог городов (грузим один раз)
  const [cities, setCities] = useState<CityCatalogItem[]>([])
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [citySearch, setCitySearch] = useState("")

  // Выбранные города/запросы
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [queries, setQueries] = useState<string[]>([])
  const [queryInput, setQueryInput] = useState("")
  const [customUrl, setCustomUrl] = useState("")

  // Модалка выбора городов. draftCities — рабочий буфер: юзер может
  // отменить выбор кнопкой «Отмена», тогда selectedCities не изменится.
  const [cityDialogOpen, setCityDialogOpen] = useState(false)
  const [draftCities, setDraftCities] = useState<string[]>([])

  // Колонки
  const [columnsData, setColumnsData] = useState<ColumnsAvailable>({ default: [], extra: [] })
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  // Опции постобработки
  const [autosizeColumns, setAutosizeColumns] = useState(true)
  const [wrapText, setWrapText] = useState(false)
  const [sortByName, setSortByName] = useState(false)
  const [networksMinCount, setNetworksMinCount] = useState<string>("")

  // Другие параметры
  const [maxRecords, setMaxRecords] = useState<string>("")
  const [delayMinMs, setDelayMinMs] = useState(3000)
  const [delayMaxMs, setDelayMaxMs] = useState(5000)

  const [submitting, setSubmitting] = useState(false)

  // ── Инициализация каталогов ──
  useEffect(() => {
    listCatalogCities("kz").then(data => {
      setCities(data)
      setCitiesLoading(false)
    })
    getColumnsAvailable().then(data => {
      setColumnsData(data)
      // По умолчанию — все default колонки включены.
      setSelectedColumns(data.default)
    })
  }, [])

  // ── Фильтр городов по поиску ──
  const filteredCities = useMemo(() => {
    if (!citySearch) return cities
    const s = citySearch.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s))
  }, [cities, citySearch])

  // ── Управление тегами запросов ──
  const addQuery = () => {
    const q = queryInput.trim()
    if (q && !queries.includes(q)) {
      setQueries([...queries, q])
    }
    setQueryInput("")
  }
  const removeQuery = (q: string) => setQueries(queries.filter(x => x !== q))
  const onQueryKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addQuery()
    }
  }

  // Toggle внутри модалки — меняет draft, а не финальный state
  const toggleDraftCity = (code: string) => {
    setDraftCities(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    )
  }

  // Открытие модалки: seed из selectedCities
  const openCityDialog = () => {
    setDraftCities([...selectedCities])
    setCitySearch("")
    setCityDialogOpen(true)
  }

  const applyCityDialog = () => {
    setSelectedCities(draftCities)
    setCityDialogOpen(false)
  }

  // Удаление отдельного города прямо с чипа
  const removeCity = (code: string) => {
    setSelectedCities(prev => prev.filter(c => c !== code))
  }

  // Быстрый lookup для отображения русского имени на чипе
  const cityByCode = useMemo(() => {
    const m: Record<string, string> = {}
    cities.forEach(c => { m[c.code] = c.name })
    return m
  }, [cities])

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col],
    )
  }

  const canSubmit = name.trim().length > 0 && (
    mode === "catalog"
      ? selectedCities.length > 0 && queries.length > 0
      : customUrl.trim().length > 0
  )

  const totalPairs = mode === "catalog" ? selectedCities.length * queries.length : 1

  const handleSubmit = async () => {
    if (!canSubmit) {
      const missing: string[] = []
      if (!name.trim()) missing.push("название задачи")
      if (mode === "catalog") {
        if (selectedCities.length === 0) missing.push("хотя бы один город")
        if (queries.length === 0) missing.push("хотя бы один запрос")
      } else if (!customUrl.trim()) {
        missing.push("URL 2GIS")
      }
      toast({
        title: "Не хватает данных",
        description: "Заполни: " + missing.join(", "),
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    const input = mode === "catalog"
      ? {
          cities: selectedCities,
          queries,
          custom_url: null,
        }
      : {
          cities: [],
          queries: [],
          custom_url: customUrl.trim(),
        }

    const res = await createCollectorTask({
      name: name.trim(),
      ...input,
      keep_columns: selectedColumns.length > 0 ? selectedColumns : null,
      drop_other_columns: true,
      autosize_columns: autosizeColumns,
      wrap_text: wrapText,
      sort_by_name: sortByName,
      networks_min_count: networksMinCount ? parseInt(networksMinCount) : null,
      max_records: maxRecords ? parseInt(maxRecords) : null,
      delay_min_ms: delayMinMs,
      delay_max_ms: delayMaxMs,
    })
    setSubmitting(false)

    if (res.success) {
      toast({
        title: "Задача создана",
        description: `#${res.data?.id} — в очереди воркера, стартует автоматически.`,
      })
      // Ресетим поля чтобы сразу можно было создать следующую задачу.
      setName("")
      setSelectedCities([])
      setQueries([])
      setQueryInput("")
      setCustomUrl("")
      setNetworksMinCount("")
      onCreated()
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Название задачи — обязательное поле */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">
          Название задачи <span className="text-red-500">*</span>
        </Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Например: «Кофейни Алматы, август»"
          maxLength={200}
        />
        <p className="text-xs text-gray-400 mt-1">
          Через месяц в истории пригодится, чтобы понять что это был за прогон.
        </p>
      </div>

      {/* Режим ввода */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Как задать выборку</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "catalog" ? "default" : "outline"}
            onClick={() => setMode("catalog")}
            className={mode === "catalog" ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Города × запросы
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
            className={mode === "url" ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
          >
            <Link2 className="h-4 w-4 mr-1" />
            Готовый URL 2GIS
          </Button>
        </div>
      </div>

      {mode === "catalog" ? (
        <>
          {/* Города — кнопка «Выбрать город» + чипы выбранных */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              Города Казахстана
              {selectedCities.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  выбрано {selectedCities.length}
                </span>
              )}
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedCities.map(code => (
                <RemovableChip
                  key={code}
                  label={cityByCode[code] || code}
                  onRemove={() => removeCity(code)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCityDialog}
                className="rounded-full"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {selectedCities.length === 0 ? "Выбрать город" : "Добавить / изменить"}
              </Button>
            </div>
          </div>

          {/* Запросы */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              Поисковые запросы
              {queries.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  {queries.length}
                </span>
              )}
            </Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={onQueryKeydown}
                placeholder="Кофейня, минимаркет, столовая... Enter — добавить"
              />
              <Button type="button" variant="outline" onClick={addQuery}>Добавить</Button>
            </div>
            {queries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {queries.map(q => (
                  <RemovableChip key={q} label={q} onRemove={() => removeQuery(q)} />
                ))}
              </div>
            )}
          </div>

          {selectedCities.length > 0 && queries.length > 0 && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
              → Будет собрано {totalPairs} файлов ({selectedCities.length} городов × {queries.length} запросов).
              Каждая пара — 30-60 минут, суммарно ~{Math.round(totalPairs * 45)} мин.
            </div>
          )}
        </>
      ) : (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Готовый URL 2GIS</Label>
          <Textarea
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://2gis.kz/astana/search/кофейня"
            className="font-mono text-xs"
            rows={2}
          />
          <p className="text-xs text-gray-500 mt-1">
            Открой 2GIS в браузере, выбери город + запрос + фильтры → скопируй URL. Формат:
            <code className="ml-1 bg-gray-100 px-1 py-0.5 rounded">https://2gis.&lt;домен&gt;/&lt;город&gt;/search/&lt;запрос&gt;</code>.
          </p>
        </div>
      )}

      {/* Колонки */}
      <div>
        <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          Колонки в итоговом файле
          <span className="text-xs text-gray-500 font-normal">
            выбрано {selectedColumns.length}
          </span>
        </Label>
        <div className="text-xs text-gray-500 mb-2">
          Стандартные (обычно нужны):
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
          {columnsData.default.map(col => (
            <label
              key={col}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded border text-sm cursor-pointer hover:bg-gray-50",
                selectedColumns.includes(col) && "bg-yellow-50 border-yellow-300",
              )}
            >
              <Checkbox
                checked={selectedColumns.includes(col)}
                onCheckedChange={() => toggleColumn(col)}
              />
              <span>{col}</span>
            </label>
          ))}
        </div>
        {columnsData.extra.length > 0 && (
          <>
            <div className="text-xs text-gray-500 mb-2">Дополнительные:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {columnsData.extra.map(col => (
                <label
                  key={col}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded border text-sm cursor-pointer hover:bg-gray-50",
                    selectedColumns.includes(col) && "bg-yellow-50 border-yellow-300",
                  )}
                >
                  <Checkbox
                    checked={selectedColumns.includes(col)}
                    onCheckedChange={() => toggleColumn(col)}
                  />
                  <span>{col}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Опции постобработки */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Опции файла</Label>
        <div className="flex items-center gap-3">
          <Switch checked={autosizeColumns} onCheckedChange={setAutosizeColumns} />
          <Label className="cursor-pointer text-sm">
            Автоширина колонок под содержимое
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={wrapText} onCheckedChange={setWrapText} />
          <Label className="cursor-pointer text-sm">
            Переносить длинный текст в ячейках (авто-высота при открытии в Excel)
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={sortByName} onCheckedChange={setSortByName} />
          <Label className="cursor-pointer text-sm">Сортировать по названию</Label>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm w-64">Оставить только сети (мин. точек)</Label>
          <Input
            type="number"
            min={0}
            value={networksMinCount}
            onChange={e => setNetworksMinCount(e.target.value)}
            placeholder="0 — не фильтровать"
            className="w-56"
          />
        </div>
        {showAdvancedSettings && (
          <>
            <div className="pt-2 mt-2 border-t">
              <div className="text-xs text-gray-500 mb-2">Расширенные (только для владельца системы):</div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm w-64">
                Максимум записей с одного URL
                <span className="block text-xs text-gray-400 font-normal">
                  0 / пусто — авто по ОЗУ (~2900 записей на 8 ГБ). 2GIS не отдаёт больше
                  ~4000 карточек, ограничение имеет смысл только для сдерживания зависаний.
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                value={maxRecords}
                onChange={e => setMaxRecords(e.target.value)}
                placeholder="Авто"
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm w-64">Пауза между кликами (мс)</Label>
              <Input
                type="number"
                min={0}
                value={delayMinMs}
                onChange={e => setDelayMinMs(parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-xs text-gray-400">–</span>
              <Input
                type="number"
                min={0}
                value={delayMaxMs}
                onChange={e => setDelayMaxMs(parseInt(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          </>
        )}
      </div>

      {/* Единственная кнопка запуска — модалки больше нет, страница живая */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Запустить сбор
        </Button>
      </div>

      {/* Модалка выбора городов */}
      <Dialog open={cityDialogOpen} onOpenChange={setCityDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите города</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Поиск по названию..."
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="text-xs text-gray-500 -mt-1">
            Выбрано {draftCities.length} из {filteredCities.length}
          </div>
          <div className="border rounded-lg overflow-y-auto flex-1 min-h-0">
            {citiesLoading ? (
              <div className="text-sm text-gray-500 py-8 text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Загружаем справочник...
              </div>
            ) : filteredCities.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">Ничего не нашлось</div>
            ) : (
              filteredCities.map(city => {
                const on = draftCities.includes(city.code)
                return (
                  <button
                    key={city.code}
                    type="button"
                    onClick={() => toggleDraftCity(city.code)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0",
                      on && "bg-yellow-50 hover:bg-yellow-100",
                    )}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggleDraftCity(city.code)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="text-sm flex-1">{city.name}</span>
                    <span className="text-xs text-gray-400">2gis.{city.domain}/{city.code}</span>
                  </button>
                )
              })
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCityDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={applyCityDialog}
              className="bg-yellow-400 hover:bg-yellow-500 text-black rounded-full"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


/**
 * Чип с крестиком, который появляется при наведении. Один и тот же
 * компонент для городов и поисковых запросов — единый визуал.
 */
function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className={cn(
        "group inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-sm",
        "bg-yellow-100 border border-yellow-300",
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать «${label}»`}
        className={cn(
          "rounded-full p-0.5 transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "hover:bg-yellow-200",
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
