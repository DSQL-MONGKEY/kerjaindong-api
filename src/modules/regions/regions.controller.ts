import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { QueryRegionDto } from './dto/query-region.dto';
import { RegionsService } from './regions.service';

@Public()
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  findAll(@Query() query: QueryRegionDto) {
    return this.regionsService.findAll(query);
  }
}
