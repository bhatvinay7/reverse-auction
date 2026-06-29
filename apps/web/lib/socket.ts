import { EventEmitter } from 'events';

// Create a mock socket class that simulates Socket.io client behavior
class MockSocket extends EventEmitter {
  public id = 'mock-user-123';
  public connected = true;

  constructor() {
    super();
    this.simulateBidding();
  }

  // Simulate server receiving a bid from this client
  emit(event: string, ...args: any[]) {
    if (event === 'place_bid') {
      const bid = args[0];
      // Simulate server acknowledging and broadcasting the bid back
      setTimeout(() => {
        this.emitToClient('new_bid', {
          id: `bid-${Date.now()}`,
          amount: bid.amount,
          vendor: 'You (Current User)',
          rating: 5.0,
          isCurrentUser: true,
          timestamp: new Date().toISOString()
        });
      }, 500); // 500ms network delay simulation
    }
    return super.emit(event, ...args);
  }

  // Internal method to trigger client events from our "mock server"
  private emitToClient(event: string, data: any) {
    super.emit(event, data);
  }

  private simulateBidding() {
    const competitors = [
      { name: 'Global Freight Co.', rating: 4.8 },
      { name: 'FastTrack Logistics', rating: 4.5 },
      { name: 'Apex Hauling', rating: 4.9 },
    ];

    let currentLowest = 2450;

    // Periodically generate competitor bids
    setInterval(() => {
      // Random chance (30%) a competitor bids every 4 seconds
      if (Math.random() > 0.7) {
        const comp = competitors[Math.floor(Math.random() * competitors.length)];
        if (!comp) return;
        const decrement = Math.floor(Math.random() * 50) + 10;
        currentLowest -= decrement;

        if (currentLowest < 1200) currentLowest = 1200; // Floor price

        this.emitToClient('new_bid', {
          id: `bid-${Date.now()}`,
          amount: currentLowest,
          vendor: comp.name,
          rating: comp.rating,
          isCurrentUser: false,
          timestamp: new Date().toISOString()
        });
      }
    }, 4000);
  }
}

// Singleton instance
export const socket = new MockSocket();
