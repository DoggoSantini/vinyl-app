import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  standalone: true,
})
export class CardComponent {
  @Input() imageUrl: string = '';
  @Input() wikiText: string = '';
  @Input() query: string = '';
  @Input() index: number = -1;
  @Output() removeCard = new EventEmitter<number>();

  onRemove() {
    this.removeCard.emit(this.index);
  }
}
