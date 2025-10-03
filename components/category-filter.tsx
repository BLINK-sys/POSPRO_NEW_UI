"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CategoryData } from "@/app/actions/public"

interface CategoryFilterProps {
  categories: CategoryData[]
  selectedCategoryId: number | null
  onCategorySelect: (categoryId: number | null) => void
  className?: string
}

export default function CategoryFilter({ 
  categories, 
  selectedCategoryId, 
  onCategorySelect,
  className = ""
}: CategoryFilterProps) {
  if (!categories || categories.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Кнопка "Все категории" */}
      <Button
        variant={selectedCategoryId === null ? "default" : "outline"}
        size="sm"
        onClick={() => onCategorySelect(null)}
        className={`text-sm px-4 py-2 rounded-full transition-all duration-200 ${
          selectedCategoryId === null
            ? "bg-brand-yellow text-black hover:bg-yellow-500 shadow-md"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
        }`}
      >
        Все категории
      </Button>

      {/* Кнопки категорий */}
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedCategoryId === category.id ? "default" : "outline"}
          size="sm"
          onClick={() => onCategorySelect(category.id)}
          className={`text-sm px-4 py-2 rounded-full transition-all duration-200 ${
            selectedCategoryId === category.id
              ? "bg-brand-yellow text-black hover:bg-yellow-500 shadow-md"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
          }`}
        >
          {category.name}
        </Button>
      ))}
    </div>
  )
}

