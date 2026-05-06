import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { KeycloakAdminService } from '../auth/keycloak-admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') // ✅ seulement admin
export class AdminController {
  [x: string]: any;
  constructor(private readonly kcAdmin: KeycloakAdminService) {}

  // GET /admin/users?search=xxx
  @Get('users')
  listUsers(@Query('search') search?: string) {
    return this.kcAdmin.listUsers(search);
  }

  // POST /admin/users
  @Post('users')
  createUser(
    @Body()
    body: {
      username: string;
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    return this.kcAdmin.createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      enabled: true,
    });
  }

  // PATCH /admin/users/:id/block
  @Patch('users/:id/block')
  block(@Param('id') id: string) {
    return this.kcAdmin.setEnabled(id, false);
  }

  // PATCH /admin/users/:id/unblock
  @Patch('users/:id/unblock')
  unblock(@Param('id') id: string) {
    return this.kcAdmin.setEnabled(id, true);
  }

  // PATCH /admin/users/:id/password
  @Patch('users/:id/password')
  setPassword(@Param('id') id: string, @Body('password') password: string) {
    if (!password) {
      throw new Error('Le mot de passe est requis');
    }
    return this.kcAdmin.setPassword(id, password);
  }

  // DELETE /admin/users/:id
  @Delete('users/:id')
  remove(@Param('id') id: string) {
    return this.kcAdmin.deleteUser(id);
  }
  // PATCH /admin/users/:id/block

  // PATCH /admin/users/:id/unblock

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.kcAdmin.updateUser(id, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      attributes: body.attributes,
    });
  }
}
