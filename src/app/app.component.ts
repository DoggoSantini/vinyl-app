import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { CardComponent } from './components/card/card.component';
import { CommonModule } from '@angular/common';
import { CardData } from './components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CardComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'vinyl-app';
  cards: CardData[] = [];

  addCard(cardData: CardData) {
    this.cards.push(cardData);
  }

  removeCard(index: number) {
    this.cards.splice(index, 1);
  }
}
