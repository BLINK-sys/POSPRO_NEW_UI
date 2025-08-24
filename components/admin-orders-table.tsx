'use client'

import { useState } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Eye, UserCheck, CreditCard, Package } from 'lucide-react'
import Image from 'next/image'
import { API_BASE_URL } from '@/lib/api-address'
import { useToast } from '@/hooks/use-toast'
import { 
  AdminOrder, 
  Manager, 
  OrderStatus,
  OrderItem,
  assignManager,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderDetails,
  getOrderItems,
  getNewOrders,
  getMyOrders,
  getCompletedOrders,
  acceptOrder,
  transferOrder
} from '@/app/actions/admin-orders'

interface AdminOrdersTableProps {
  initialOrders: AdminOrder[]
  managers: Manager[]
  statuses: OrderStatus[]
  showOnlyAcceptButton?: boolean // Показывать только кнопку "Принять" (для новых заказов)
  showOnlyTransferButton?: boolean // Показывать только кнопку "Передать" (для моих заказов)
  hideManagerButtons?: boolean // Скрыть все кнопки менеджера (для завершенных заказов)
  hideManagerName?: boolean // Скрыть имя менеджера в колонке
  onOrderUpdate?: () => void // Callback для обновления списка заказов
}

interface TransferDialogProps {
  orderId: number
  orderNumber: string
  managers: Manager[]
  isOpen: boolean
  onClose: () => void
  onTransfer: (orderId: number, managerId: number) => void
}

function TransferDialog({ orderId, orderNumber, managers, isOpen, onClose, onTransfer }: TransferDialogProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')

  const handleTransfer = () => {
    if (selectedManagerId) {
      onTransfer(orderId, parseInt(selectedManagerId))
      onClose()
      setSelectedManagerId('')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Передать заказ {orderNumber}</DialogTitle>
          <DialogDescription>
            Выберите менеджера, которому хотите передать заказ
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="manager">Менеджер</Label>
            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите менеджера" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id.toString()}>
                    {manager.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleTransfer}
            disabled={!selectedManagerId}
          >
            Передать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface OrderDetailsDialogProps {
  orderId: number
  orderNumber: string
  isOpen: boolean
  onClose: () => void
}

function OrderDetailsDialog({ orderId, orderNumber, isOpen, onClose }: OrderDetailsDialogProps) {
  const [orderDetails, setOrderDetails] = useState<AdminOrder | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadOrderDetails = async () => {
    setIsLoading(true)
    try {
      // Загружаем основную информацию о заказе
      const orderResult = await getOrderDetails(orderId)
      if (orderResult.success) {
        setOrderDetails(orderResult.data)
      }

      // Загружаем товары заказа отдельно для получения правильных цен
      const itemsResult = await getOrderItems(orderId)
      if (itemsResult.success) {
        setOrderItems(itemsResult.data.items)
      }
    } catch (error) {
      console.error('Ошибка загрузки деталей заказа:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isOpen && !orderDetails && !isLoading) {
    loadOrderDetails()
  }

  const handleClose = () => {
    setOrderDetails(null)
    setOrderItems([])
    onClose()
  }

  // Функция для перевода способа оплаты на русский
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Наличными'
      case 'card':
        return 'Картой'
      case 'transfer':
        return 'Банковский перевод'
      default:
        return method
    }
  }

  // Функция для форматирования цены без десятичных знаков
  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString('ru-RU')
  }

  // Функция для получения валидного URL изображения
  const getImageUrl = (imageUrl: string | null | undefined): string => {
    try {
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === "") {
        return "/placeholder.svg"
      }
      
      const trimmedUrl = imageUrl.trim()
      
      // Если URL уже полный
      if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
        return trimmedUrl
      }
      
      // Если URL начинается с /uploads/, добавляем префикс API сервера
      if (trimmedUrl.startsWith("/uploads/")) {
        return `${API_BASE_URL}${trimmedUrl}`
      }
      
      // Для остальных относительных ссылок также добавляем префикс
      return `${API_BASE_URL}${trimmedUrl.startsWith("/") ? trimmedUrl : `/${trimmedUrl}`}`
    } catch (error) {
      console.error("Error processing image URL:", imageUrl, error)
      return "/placeholder.svg"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Детали заказа {orderNumber}</DialogTitle>
          <DialogDescription>
            Подробная информация о заказе и товарах
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : orderDetails ? (
          <div className="space-y-6">
            {/* Информация о клиенте */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Информация о клиенте</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Имя:</strong> {orderDetails.customer_name}</div>
                  <div><strong>Email:</strong> {orderDetails.customer_email}</div>
                  <div><strong>Телефон:</strong> {orderDetails.customer_phone}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Информация о доставке</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Способ:</strong> {orderDetails.delivery_method === 'delivery' ? 'Доставка' : 'Самовывоз'}</div>
                  {orderDetails.delivery_address && (
                    <div><strong>Адрес:</strong> {orderDetails.delivery_address}</div>
                  )}
                  <div><strong>Оплата:</strong> {getPaymentMethodText(orderDetails.payment_method)}</div>
                </div>
              </div>
            </div>

            {/* Товары */}
            <div>
              <h3 className="font-semibold mb-2">Товары в заказе</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {/* Изображение товара */}
                          <div className="w-12 h-12 relative flex-shrink-0">
                            {item.current_product?.image_url ? (
                              <Image
                                src={getImageUrl(item.current_product.image_url)}
                                alt={item.product_name}
                                fill
                                className="object-cover rounded"
                                unoptimized
                                onError={(e) => {
                                  console.error(`Failed to load image for product ${item.product_name}:`, item.current_product.image_url)
                                  e.currentTarget.src = "/placeholder.svg"
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          {/* Информация о товаре */}
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            {item.product_article && (
                              <div className="text-sm text-gray-500">Артикул: {item.product_article}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatPrice(item.price_per_item)} ₸</TableCell>
                      <TableCell>{formatPrice(item.total_price)} ₸</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Итого */}
            <div className="text-right">
              <div className="text-lg font-semibold">
                Итого: {formatPrice(orderDetails.total_amount)} ₸
              </div>
            </div>

            {/* Комментарии */}
            {(orderDetails.customer_comment || orderDetails.admin_comment) && (
              <div className="space-y-2">
                <h3 className="font-semibold">Комментарии</h3>
                {orderDetails.customer_comment && (
                  <div className="p-3 bg-gray-50 rounded">
                    <strong>Клиент:</strong> {orderDetails.customer_comment}
                  </div>
                )}
                {orderDetails.admin_comment && (
                  <div className="p-3 bg-blue-50 rounded">
                    <strong>Администратор:</strong> {orderDetails.admin_comment}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>Не удалось загрузить детали заказа</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AdminOrdersTable({ 
  initialOrders, 
  managers, 
  statuses, 
  showOnlyAcceptButton = false,
  showOnlyTransferButton = false,
  hideManagerButtons = false,
  hideManagerName = false,
  onOrderUpdate 
}: AdminOrdersTableProps) {
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<{ id: number; number: string } | null>(null)
  const [transferDialog, setTransferDialog] = useState<{ orderId: number; orderNumber: string } | null>(null)
  const { toast } = useToast()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0
    }).format(price)
  }

  const getStatusBadge = (status: OrderStatus) => {
    return (
      <Badge 
        style={{
          backgroundColor: status.background_color,
          color: status.text_color
        }}
      >
        {status.name}
      </Badge>
    )
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusMap = {
      unpaid: { label: 'Не оплачен', color: 'bg-red-100 text-red-800' },
      paid: { label: 'Оплачен', color: 'bg-green-100 text-green-800' },
      refunded: { label: 'Возврат', color: 'bg-gray-100 text-gray-800' }
    }
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.unpaid
    
    return (
      <Badge className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    )
  }

  const handleAcceptOrder = async (orderId: number) => {
    try {
      const result = await acceptOrder(orderId)
      if (result.success) {
        toast({
          title: 'Успешно!',
          description: result.message
        })
        // Обновляем заказ в списке
        setOrders(prev => prev.map(order => 
          order.id === orderId ? result.data : order
        ))
        // Вызываем callback для обновления данных в родительском компоненте
        onOrderUpdate?.()
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось принять заказ',
        variant: 'destructive'
      })
    }
  }

  const handleTransferOrder = async (orderId: number, managerId: number) => {
    try {
      const result = await transferOrder(orderId, managerId)
      if (result.success) {
        toast({
          title: 'Успешно!',
          description: result.message
        })
        // Обновляем заказ в списке
        setOrders(prev => prev.map(order => 
          order.id === orderId ? result.data : order
        ))
        // Закрываем диалог передачи
        setTransferDialog(null)
        // Вызываем callback для обновления данных в родительском компоненте
        onOrderUpdate?.()
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось передать заказ',
        variant: 'destructive'
      })
    }
  }

  const handleUpdateStatus = async (orderId: number, statusId: number) => {
    try {
      const result = await updateOrderStatus(orderId, statusId)
      if (result.success) {
        toast({
          title: 'Успешно!',
          description: result.message
        })
        // Обновляем заказ в списке
        setOrders(prev => prev.map(order => 
          order.id === orderId ? result.data : order
        ))
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
        variant: 'destructive'
      })
    }
  }

  const handleUpdatePaymentStatus = async (orderId: number, paymentStatus: string) => {
    try {
      const result = await updatePaymentStatus(orderId, paymentStatus)
      if (result.success) {
        toast({
          title: 'Успешно!',
          description: result.message
        })
        // Обновляем заказ в списке
        setOrders(prev => prev.map(order => 
          order.id === orderId ? result.data : order
        ))
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус оплаты',
        variant: 'destructive'
      })
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>№ Заказа</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Оплата</TableHead>
              <TableHead>Менеджер</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length ? (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{order.user?.name}</div>
                      <div className="text-sm text-muted-foreground">{order.user?.email}</div>
                      <div className="text-sm text-muted-foreground">{order.user?.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{formatPrice(order.total_amount)}</TableCell>
                  <TableCell>
                    <Select
                      value={order.status_id.toString()}
                      onValueChange={(value) => handleUpdateStatus(order.id, parseInt(value))}
                    >
                      <SelectTrigger className="w-auto">
                        <SelectValue asChild>
                          {getStatusBadge(order.status_info)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            <Badge 
                              style={{
                                backgroundColor: status.background_color,
                                color: status.text_color
                              }}
                            >
                              {status.name}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.payment_status}
                      onValueChange={(value) => handleUpdatePaymentStatus(order.id, value)}
                    >
                      <SelectTrigger className="w-auto">
                        <SelectValue asChild>
                          {getPaymentStatusBadge(order.payment_status)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">
                          <Badge className="bg-red-100 text-red-800">Не оплачен</Badge>
                        </SelectItem>
                        <SelectItem value="paid">
                          <Badge className="bg-green-100 text-green-800">Оплачен</Badge>
                        </SelectItem>
                        <SelectItem value="refunded">
                          <Badge className="bg-gray-100 text-gray-800">Возврат</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {hideManagerButtons ? (
                      // Для завершенных заказов - не показываем кнопки
                      hideManagerName ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        order.manager?.manager ? (
                          <div className="text-sm font-medium">
                            {order.manager.manager.full_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Не назначен</span>
                        )
                      )
                    ) : (
                      // Для активных заказов - показываем кнопки
                      order.manager?.manager ? (
                        <div className="space-y-2">
                          {!hideManagerName && (
                            <div className="text-sm font-medium">
                              {order.manager.manager.full_name}
                            </div>
                          )}
                          {(!showOnlyAcceptButton) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTransferDialog({ 
                                orderId: order.id, 
                                orderNumber: order.order_number 
                              })}
                            >
                              Передать
                            </Button>
                          )}
                        </div>
                      ) : (
                        (!showOnlyTransferButton) && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAcceptOrder(order.id)}
                          >
                            Принять
                          </Button>
                        )
                      )
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString('ru-RU')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrderDetails({ id: order.id, number: order.order_number })}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Заказы не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedOrderDetails && (
        <OrderDetailsDialog
          orderId={selectedOrderDetails.id}
          orderNumber={selectedOrderDetails.number}
          isOpen={!!selectedOrderDetails}
          onClose={() => setSelectedOrderDetails(null)}
        />
      )}

      {transferDialog && (
        <TransferDialog
          orderId={transferDialog.orderId}
          orderNumber={transferDialog.orderNumber}
          managers={managers}
          isOpen={!!transferDialog}
          onClose={() => setTransferDialog(null)}
          onTransfer={handleTransferOrder}
        />
      )}
    </>
  )
}
