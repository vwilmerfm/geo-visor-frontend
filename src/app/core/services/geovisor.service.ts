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

  descargarExcel(nivel: string, id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/descargar-excel?nivel=${nivel}&id=${id}`, {
      responseType: 'blob'
    });
  }

  getSectores(comunidadId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sectores/${comunidadId}`);
  }

  getSectoresPorMunicipio(municipioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sectores-municipio/${municipioId}`);
  }

  getPrediosMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/predios-municipio/${id}`);
  }

  getManzanosMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/manzanos-municipio/${id}`);
  }

  getPeriurbanoMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/periurbano-municipio/${id}`);
  }

  getUpasMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/upas-municipio/${id}`);
  }

  getAreaCensalMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/areacensal-municipio/${id}`);
  }

  descargarExcelSectoresMunicipal(municipioId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/descargar-excel-sectores-municipal/${municipioId}`, {
      responseType: 'blob'
    });
  }

  getSuperAreaMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/superarea-municipio/${id}`);
  }

  getAreaTrabajoMunicipio(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/areatrabajo-municipio/${id}`);
  }
}
