"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Client, SystemUser } from "@/app/actions/users"
import { ClientsTable } from "./clients-table"
import { SystemUsersTable } from "./system-users-table"
import { WholesaleClientsTable } from "./wholesale-clients-table"

interface UserManagementTabsProps {
  clients: Client[]
  systemUsers: SystemUser[]
  wholesaleClients: Client[]
}

export function UserManagementTabs({ clients, systemUsers, wholesaleClients }: UserManagementTabsProps) {
  return (
    <Tabs defaultValue="clients" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="clients">Клиенты</TabsTrigger>
        <TabsTrigger value="wholesale">Оптовые</TabsTrigger>
        <TabsTrigger value="system-users">Системные пользователи</TabsTrigger>
      </TabsList>
      <TabsContent value="clients">
        <ClientsTable data={clients} />
      </TabsContent>
      <TabsContent value="wholesale">
        <WholesaleClientsTable data={wholesaleClients} />
      </TabsContent>
      <TabsContent value="system-users">
        <SystemUsersTable data={systemUsers} />
      </TabsContent>
    </Tabs>
  )
}
