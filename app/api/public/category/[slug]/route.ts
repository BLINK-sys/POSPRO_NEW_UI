import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    
    // Вызов к вашему серверу с правильным путем
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/public/category/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Отключаем кэширование
      cache: 'no-store',
      next: { revalidate: 0 }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Категория не найдена' },
        { status: 404 }
      )
    }

    const data = await response.json()
    
    // Создаем ответ с заголовками для отключения кэширования
    const response_data = NextResponse.json(data)
    response_data.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response_data.headers.set('Pragma', 'no-cache')
    response_data.headers.set('Expires', '0')
    
    return response_data
  } catch (error) {
    console.error('Error fetching category data:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
} 