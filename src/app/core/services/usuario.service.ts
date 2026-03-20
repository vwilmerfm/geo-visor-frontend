import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  getUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios`);
  }

  buscarUsuariosAD(termino: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/buscar-ad/${termino}`);
  }

  crearUsuario(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/crear-usuario`, usuario);
  }

  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/roles`);
  }

  crearAdminLocal(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/crear-admin`, usuario);
  }

  actualizarUsuario(id: number, datos: { rol_id: number, activo: boolean }): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuario/${id}`, datos);
  }
}
