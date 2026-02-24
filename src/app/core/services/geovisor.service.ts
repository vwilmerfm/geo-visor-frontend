import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeovisorService {
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/map`;

  constructor() {}

  getDepartamentos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/departamentos`);
  }

  getMunicipios(departamentoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/municipios/${departamentoId}`);
  }

  getComunidades(municipioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/comunidades/${municipioId}`);
  }

  getEstadisticas(nivel: string, id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/estadisticas?nivel=${nivel}&id=${id}`);
  }

  getApaComunidad(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/apa-comunidad/${id}`);
  }
}
