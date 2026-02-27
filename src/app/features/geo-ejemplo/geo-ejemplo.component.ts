import { Component, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-geo-ejemplo',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './geo-ejemplo.component.html',
  styleUrl: './geo-ejemplo.component.scss'
})
export class GeoEjemploComponent implements OnInit {
    ngOnInit(): void {
        throw new Error("Method not implemented.");
    }
}
