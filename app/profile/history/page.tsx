import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card'

export default function ProfileHistoryPage() {
  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>История покупок</CardTitle>
          <CardDescription>Список всех купленных вами товаров.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Таблица с историей покупок будет здесь.</p>
        </CardContent>
      </Card>
    </div>
  )
}
