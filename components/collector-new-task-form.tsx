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
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, MapPin, Search, Link2, Sliders, Play } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  onCreated: () => void
  onCancel: () => void
}

export default function CollectorNewTaskForm({ onCreated, onCancel }: Props) {
  const { toast } = useToast()

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

  const toggleCity = (code: string) => {
    setSelectedCities(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    )
  }

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col],
    )
  }

  const canSubmit = mode === "catalog"
    ? selectedCities.length > 0 && queries.length > 0
    : customUrl.trim().length > 0

  const totalPairs = mode === "catalog" ? selectedCities.length * queries.length : 1

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "Не хватает данных",
        description: mode === "catalog"
          ? "Выбери хотя бы один город и добавь хотя бы один запрос."
          : "Вставь URL 2GIS.",
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
      onCreated()
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
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
          {/* Города */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              Города Казахстана
              {selectedCities.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  выбрано {selectedCities.length}
                </span>
              )}
            </Label>
            <div className="mb-2">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Поиск по названию..."
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {citiesLoading ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Загружаем справочник...
              </div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredCities.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">Ничего не нашлось</div>
                ) : (
                  filteredCities.map(city => {
                    const on = selectedCities.includes(city.code)
                    return (
                      <button
                        key={city.code}
                        type="button"
                        onClick={() => toggleCity(city.code)}
                        className={cn(
                          "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 border-b last:border-0",
                          on && "bg-yellow-50 hover:bg-yellow-100",
                        )}
                      >
                        <Checkbox checked={on} onCheckedChange={() => toggleCity(city.code)} />
                        <span className="text-sm">{city.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">2gis.{city.domain}/{city.code}</span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
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
                  <span
                    key={q}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm"
                  >
                    {q}
                    <button
                      type="button"
                      onClick={() => removeQuery(q)}
                      className="hover:bg-yellow-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
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
            className="w-32"
          />
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm w-64">Максимум записей с одного URL</Label>
          <Input
            type="number"
            min={0}
            value={maxRecords}
            onChange={e => setMaxRecords(e.target.value)}
            placeholder="Авто (по ОЗУ)"
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
      </div>

      {/* Кнопки */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
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
    </div>
  )
}
