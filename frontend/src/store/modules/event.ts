import { defineStore } from 'pinia'

interface Event {
  id: string
  title: string
  content: string
  startDate: string
  endDate: string
  result: string
  status: '进行中' | '已完成' | '已取消'
  categoryId: number | null
  type: {
    level1: string
    level2: string
    level3: string
  }
  files: string[]
}

interface EventState {
  events: Event[]
  currentEvent: Event | null
}

export const useEventStore = defineStore('event', {
  state: (): EventState => ({
    events: [],
    currentEvent: null
  }),
  actions: {
    setEvents(events: Event[]) {
      this.events = events
    },
    setCurrentEvent(event: Event) {
      this.currentEvent = event
    },
    addEvent(event: Event) {
      this.events.push(event)
    },
    updateEvent(updatedEvent: Event) {
      const index = this.events.findIndex(e => e.id === updatedEvent.id)
      if (index !== -1) {
        this.events[index] = updatedEvent
      }
      if (this.currentEvent && this.currentEvent.id === updatedEvent.id) {
        this.currentEvent = updatedEvent
      }
    },
    deleteEvent(id: string) {
      this.events = this.events.filter(e => e.id !== id)
      if (this.currentEvent && this.currentEvent.id === id) {
        this.currentEvent = null
      }
    }
  }
})