"use client"

import HomepageBanner from "./homepage-banner"

interface Banner {
  id: number
  title: string
  subtitle: string
  image: string
  button_text: string
  button_link: string
  show_button: boolean
  open_in_new_tab?: boolean
  button_color?: string
  button_text_color?: string
  order: number
}

interface HomepageBannerWrapperProps {
  banners: Banner[]
}

export default function HomepageBannerWrapper({ banners }: HomepageBannerWrapperProps) {
  return <HomepageBanner banners={banners} />
}
