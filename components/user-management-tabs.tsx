"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Client, SystemUser } from "@/app/actions/users"
import { ClientsTable } from "./clients-table"
import { SystemUsersTable } from "./system-users-table"

interface UserManagementTabsProps {
  clients: Client[]
  systemUsers: SystemUser[]
}

export function UserManagementTabs({ clients, systemUsers }: UserManagementTabsProps) {
  return (
    <Tabs defaultValue="clients" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="clients">Клиенты</TabsTrigger>
        <TabsTrigger value="system-users">Системные пользователи</TabsTrigger>
      </TabsList>
      <TabsContent value="clients">
        <ClientsTable data={clients} />
      </TabsContent>
      <TabsContent value="system-users">
        <SystemUsersTable data={systemUsers} />
      </TabsContent>
    </Tabs>
  )
}
